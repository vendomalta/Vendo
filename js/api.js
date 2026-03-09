// Backend API - İlan işlemleri (CRUD)
import { supabase } from './supabase.js';
import { detectDeviceInfo, getLocationInfo } from './device-detection.js';

// JWT süresi dolduysa otomatik yenile ve bir kez daha dene
async function retryOnExpired(runFn) {
    try {
        const result = await runFn();
        // If call returned an error object (not thrown), handle JWT expired
        const msg = String(result?.error?.message || result?.error?.error_description || '');
        if (result?.error && /jwt expired|jwt_expired|JWT expired|401/i.test(msg)) {
            try { await supabase.auth.refreshSession(); } catch { await supabase.auth.signOut(); }
            return await runFn();
        }
        return result;
    } catch (e) {
        const msg = String(e?.message || e?.error_description || e);
        if (/jwt expired|jwt_expired|JWT expired|401/i.test(msg)) {
            try { await supabase.auth.refreshSession(); } catch { await supabase.auth.signOut(); }
            return await runFn();
        }
        throw e;
    }
}

// ============================================================
// İLAN İŞLEMLERİ
// ============================================================

/**
 * Yeni ilan oluştur
 * @param {Object} listingData - İlan verileri
 * @returns {Promise<Object>} Oluşturulan ilan
 */
export async function createListing(listingData) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Kullanıcı girişi gerekli');
    }

    // Başlık validation
    if (!listingData.title || !listingData.title.trim()) {
        throw new Error('İlan başlığı boş olamaz');
    }

    const title = listingData.title.trim();
    if (title.length < 5) {
        throw new Error('İlan başlığı en az 5 karakter olmalıdır');
    }

    if (title.length > 255) {
        throw new Error('İlan başlığı 255 karakteri geçemez');
    }

    // Düzeltme: extraFields verisini direkt olarak alıyoruz
    const extraFields = listingData.extraFields || {};

    // Fotoğrafları işle - object ise data alanını al, string ise direkt kullan
    const photos = (listingData.photos || []).map(photo => {
        if (typeof photo === 'object' && photo.data) {
            return photo.data; // base64 string
        }
        return photo; // zaten string
    });

    const { data, error } = await supabase
        .from('listings')
        .insert([{
            user_id: user.id,
            user_email: user.email,
            title: title,
            description: listingData.description || '',
            price: parseFloat(listingData.price) || 0,
            currency: listingData.currency || 'TL',
            category: listingData.category,
            location: listingData.location || '',
            photos: photos.length > 0 ? photos : [],
            extra_fields: extraFields, // <-- Artık veritabanındaki JSONB alanına doğru şekilde gidiyor.
            status: 'active'
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Tüm ilanları getir (sayfalama ile) - Optimize edilmiş
 * @param {Object} options - Filtreleme seçenekleri
 * @returns {Promise<Array>} İlan listesi
 */
export async function getListings(options = {}) {
    const {
        category,
        categories,
        status = 'active',
        search,
        location,
        minPrice,
        maxPrice,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 30, // 20'den 30'a çıkarıldı
        random = false // New option for random listings (home page)
    } = options;

    async function run(orderBy) {
        let query = supabase
            .from('listings')
            // Sadece gerekli alanları seç - daha hızlı
            .select('id, title, price, currency, location, category, photos, extra_fields, created_at, user_id, status', { count: 'exact' });

        if (status) query = query.eq('status', status);
        if (Array.isArray(categories) && categories.length > 0) {
            query = query.in('category_id', categories);
        } else if (category) {
            query = query.eq('category_id', category);
        }
        if (location) {
            if (Array.isArray(location) && location.length > 0) {
                const orQuery = location.map(loc => `location.ilike.%${loc}%`).join(',');
                query = query.or(orQuery);
            } else if (typeof location === 'string' && location.trim() !== '') {
                query = query.ilike('location_city', `%${location}%`);
            }
        }
        if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
        }
        if (minPrice) query = query.gte('price', minPrice);
        if (maxPrice) query = query.lte('price', maxPrice);

        // Dinamik alanlar (JSONB) filtrelemesi
        if (options.extraFields && typeof options.extraFields === 'object') {
            for (const [key, value] of Object.entries(options.extraFields)) {
                if (value !== undefined && value !== null && value !== '') {
                    if (key === 'technical_details' && Array.isArray(value) && value.length > 0) {
                        // Array içindeki tüm değerleri içeren kayıtları bul (contains)
                        query = query.contains(`extra_fields->${key}`, value);
                    } else if (!Array.isArray(value)) {
                        // Standart metin/sayı filtrelemesi
                        query = query.eq(`extra_fields->>${key}`, value);
                    }
                }
            }
        }

        // Random listings for home page: fetch with default order, randomize on client
        if (random) {
            query = query.order('created_at', { ascending: false }); // Default order, will randomize client-side
        } else if (orderBy) {
            query = query.order(orderBy, { ascending: sortOrder === 'asc' });
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);
        return await query;
    }

    // Önce created_at, olmazsa id ile sırala
    let { data, error, count } = await retryOnExpired(() => run(sortBy));
    if (error && /created_at|column|order/i.test(error.message || '')) {
        ({ data, error, count } = await retryOnExpired(() => run('id')));
    }

    // If still JWT expired, refresh and retry once more with fallback order
    if (error && /jwt expired|jwt_expired|JWT expired|401/i.test(String(error.message || ''))) {
        try { await supabase.auth.refreshSession(); } catch { await supabase.auth.signOut(); }
        ({ data, error, count } = await run('id'));
    }

    if (error) throw error;

    // Client-side randomization for home page
    if (random && data && data.length > 0) {
        // Fisher-Yates shuffle algorithm
        for (let i = data.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [data[i], data[j]] = [data[j], data[i]];
        }
    }

    return {
        data,
        totalCount: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit)
    };
}

/**
 * Tek bir ilanı getir
 * @param {String} listingId - İlan ID'si
 * @returns {Promise<Object>} İlan detayı
 */
export async function getListing(listingId) {
    let { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();

    if (error && /jwt expired|jwt_expired|JWT expired|401/i.test(String(error.message || ''))) {
        try { await supabase.auth.refreshSession(); } catch { await supabase.auth.signOut(); }
        ({ data, error } = await supabase
            .from('listings')
            .select('*')
            .eq('id', listingId)
            .single());
    }

    if (error) throw error;

    // Görüntülenme sayısını artır
    await incrementViewCount(listingId);

    return data;
}

/**
 * İlanı güncelle
 * @param {String} listingId - İlan ID'si
 * @param {Object} updates - Güncellenecek alanlar
 * @returns {Promise<Object>} Güncellenmiş ilan
 */
export async function updateListing(listingId, updates) {
    const { data, error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', listingId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * İlanı sil
 * @param {String} listingId - İlan ID'si
 * @returns {Promise<Boolean>} Başarılı mı?
 */
export async function deleteListing(listingId) {
    const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', listingId);

    if (error) throw error;
    return true;
}

/**
 * Görüntülenme sayısını artır
 * @param {String} listingId - İlan ID'si
 */
async function incrementViewCount(listingId) {
    const { error } = await supabase.rpc('increment_view_count', {
        listing_id: listingId
    });

    // RPC yoksa manuel güncelleme
    if (error) {
        const { data } = await supabase
            .from('listings')
            .select('view_count')
            .eq('id', listingId)
            .single();

        if (data) {
            await supabase
                .from('listings')
                .update({ view_count: (data.view_count || 0) + 1 })
                .eq('id', listingId);
        }
    }
}

/**
 * Kullanıcının kendi ilanlarını getir
 * @returns {Promise<Array>} İlan listesi
 */
export async function getMyListings() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Kullanıcı girişi gerekli');

    const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

// ============================================================
// FAVORİ İŞLEMLERİ
// ============================================================

/**
 * Favorilere ekle
 * @param {String} listingId - İlan ID'si
 * @returns {Promise<Boolean>} Başarılı mı?
 */
export async function addToFavorites(listingId) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Kullanıcı girişi gerekli');

    const { error } = await supabase
        .from('favorites')
        .insert([{
            user_id: user.id,
            listing_id: listingId
        }]);

    if (error) throw error;
    return true;
}

/**
 * Favorilerden çıkar
 * @param {String} listingId - İlan ID'si
 * @returns {Promise<Boolean>} Başarılı mı?
 */
export async function removeFromFavorites(listingId) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Kullanıcı girişi gerekli');

    const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId);

    if (error) throw error;
    return true;
}

/**
 * Kullanıcının favori ilanlarını getir
 * @returns {Promise<Array>} Favori ilanlar
 */
export async function getFavorites() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Kullanıcı girişi gerekli');

    const { data, error } = await supabase
        .from('favorites')
        .select(`
            *,
            listings (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('getFavorites hatası:', error);
        throw error;
    }

    console.log('Favoriler ham veri:', data);

    if (!data || data.length === 0) {
        return [];
    }

    // listings null olanları filtrele ve map et
    const favorites = data
        .filter(fav => fav.listings !== null)
        .map(fav => fav.listings);

    console.log('İşlenmiş favoriler:', favorites);
    return favorites;
}

/**
 * İlanın favori olup olmadığını kontrol et
 * @param {String} listingId - İlan ID'si
 * @returns {Promise<Boolean>} Favori mi?
 */
export async function isFavorite(listingId) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
        .maybeSingle();

    if (error) {
        console.error('isFavorite kontrol hatası:', error);
        return false;
    }

    return !!data;
}

// ============================================================
// FOTOĞRAF YÜKLEME
// ============================================================

/**
 * Fotoğraf yükle
 * @param {File} file - Yüklenecek dosya
 * @param {String} listingId - İlan ID'si (opsiyonel)
 * @returns {Promise<String>} Fotoğraf URL'si
 */
export async function uploadPhoto(file, listingId = null) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Kullanıcı girişi gerekli');

    // Dosya adını benzersiz yap
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) throw error;

    // Public URL al
    const { data: { publicUrl } } = supabase.storage
        .from('listing-photos')
        .getPublicUrl(fileName);

    return publicUrl;
}

/**
 * Birden fazla fotoğraf yükle
 * @param {Array<File>} files - Yüklenecek dosyalar
 * @returns {Promise<Array<String>>} Fotoğraf URL'leri
 */
export async function uploadPhotos(files) {
    const uploadPromises = files.map(file => uploadPhoto(file));
    return await Promise.all(uploadPromises);
}

/**
 * Fotoğraf sil
 * @param {String} photoUrl - Silinecek fotoğraf URL'si
 * @returns {Promise<Boolean>} Başarılı mı?
 */
export async function deletePhoto(photoUrl) {
    // URL'den dosya yolunu çıkar
    const path = photoUrl.split('/listing-photos/')[1];

    const { error } = await supabase.storage
        .from('listing-photos')
        .remove([path]);

    if (error) throw error;
    return true;
}

// ============================================================
// PROFİL İŞLEMLERİ
// ============================================================

/**
 * Kullanıcı profilini getir
 * @param {String} userId - Kullanıcı ID'si (opsiyonel, boş ise mevcut kullanıcı)
 * @returns {Promise<Object>} Profil bilgileri
 */
export async function getProfile(userId = null) {
    let targetUserId = userId;

    if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Kullanıcı girişi gerekli');
        targetUserId = user.id;
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Profili güncelle
 * @param {Object} updates - Güncellenecek alanlar
 * @returns {Promise<Object>} Güncellenmiş profil
 */
export async function updateProfile(updates) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Kullanıcı girişi gerekli');

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================
// OTURUM YÖNETİMİ (Session Management)
// ============================================================

/**
 * Tüm aktif oturumları getir
 * @returns {Promise<Array>} Oturum listesi
 */
export async function getSessions() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Kullanıcı girişi gerekli');

    const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Yeni oturum kaydı oluştur (giriş yapıldığında çağrılır)
 * @param {Object} deviceInfo - Cihaz bilgileri (optional, otomatik algılanabilir)
 * @returns {Promise<Object>} Oluşturulan oturum
 */
export async function createSession(deviceInfo = null) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();

    if (!user || !session) throw new Error('Kullanıcı girişi gerekli');

    // Cihaz bilgisi sağlanmazsa otomatik algıla
    let finalDeviceInfo = deviceInfo;
    if (!deviceInfo) {
        const detectedDevice = detectDeviceInfo();
        const locationInfo = await getLocationInfo();
        finalDeviceInfo = { ...detectedDevice, ...locationInfo };
    }

    // Session Identity Key Oluştur: Aynı cihaz/tarayıcı kombinasyonunu tanımlamak için
    // Format: osName + browserName + deviceModel (örn: "Windows11ChromeMacBookPro")
    const identityKey = `${finalDeviceInfo.osName || 'unknown'}|${finalDeviceInfo.browserName || 'unknown'}|${finalDeviceInfo.deviceModel || ''}`.toLowerCase();

    // Mevcut oturumları kontrol et - aynı cihaz/tarayıcı kombinasyonu var mı?
    const { data: existingSessions, error: queryError } = await supabase
        .from('user_sessions')
        .select('id, device_info')
        .eq('user_id', user.id);

    if (queryError) throw queryError;

    // Aynı device+browser kombinasyonuna sahip oturumu bul
    let existingSession = null;
    if (existingSessions && existingSessions.length > 0) {
        existingSession = existingSessions.find(session => {
            const sessionIdentityKey = `${session.device_info?.osName || 'unknown'}|${session.device_info?.browserName || 'unknown'}|${session.device_info?.deviceModel || ''}`.toLowerCase();
            return sessionIdentityKey === identityKey;
        });
    }

    // Eğer aynı device/browser kombinasyonunda oturum varsa, onu güncelle
    if (existingSession) {
        const { data: updatedData, error: updateError } = await supabase
            .from('user_sessions')
            .update({
                session_token: session.access_token.substring(0, 50),
                device_info: finalDeviceInfo,
                ip_address: finalDeviceInfo?.ip || await getClientIp(),
                user_agent: navigator.userAgent,
                last_activity: new Date().toISOString()
            })
            .eq('id', existingSession.id)
            .select()
            .single();

        if (updateError) throw updateError;
        return updatedData;
    }

    // Yoksa yeni oturum oluştur
    const { data, error } = await supabase
        .from('user_sessions')
        .insert([{
            user_id: user.id,
            session_token: session.access_token.substring(0, 50),
            device_info: finalDeviceInfo,
            ip_address: finalDeviceInfo?.ip || await getClientIp(),
            user_agent: navigator.userAgent,
            last_activity: new Date().toISOString(),
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Oturumu sonlandır (revoke)
 * @param {String} sessionId - Oturum ID'si
 * @param {Boolean} isCurrentSession - Geçerli oturum mu? (true ise Supabase signOut çağrılır)
 * @returns {Promise<Boolean>} Başarılı mı?
 */
export async function revokeSession(sessionId, isCurrentSession = false) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Kullanıcı girişi gerekli');

    // Database'den oturumu sil
    const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id); // Güvenlik: sadece kendi oturumlarını sil

    if (error) throw error;

    // Eğer bu mevcut oturum ise, Supabase'den de çıkış yap
    if (isCurrentSession) {
        await supabase.auth.signOut();
    }

    return true;
}

/**
 * Tüm diğer oturumları sonlandır (geçerli oturumdan başkasını)
 * ⚠️ ÖNEMLİ: Sadece diğer cihazların oturumlarını sonlandırır, mevcut cihaz aktif kalır
 * @returns {Promise<Boolean>} Başarılı mı?
 */
export async function revokeAllOtherSessions() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();

    if (!user || !session) throw new Error('Kullanıcı girişi gerekli');

    // Geçerli session token'ını al (mevcut cihazın token'ı)
    const currentToken = session.access_token.substring(0, 50);

    // Diğer tüm oturumları sil (mevcut token hariç)
    // .neq() ile mevcut cihaz korunur
    const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', user.id)
        .neq('session_token', currentToken);

    if (error) throw error;

    console.log('✅ Diğer tüm oturumlar sonlandırıldı, mevcut oturum korundu');
    return true;
}

/**
 * Oturumun son aktivitesini güncelle
 * @param {String} sessionId - Oturum ID'si
 * @returns {Promise<Object>} Güncellenmiş oturum
 */
export async function updateSessionActivity(sessionId) {
    const { data, error } = await supabase
        .from('user_sessions')
        .update({
            last_activity: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Client IP adresini al
 * @returns {Promise<String>} IP adresi
 */
export async function getClientIp() {
    try {
        // Açık bir IP API'si kullan
        const response = await fetch('https://api.ipify.org?format=json', {
            cache: 'no-store'
        });
        const data = await response.json();
        return data.ip || 'Unknown';
    } catch (error) {
        console.warn('IP adresi alınamadı:', error);
        return 'Unknown';
    }
}

// ============================================================
// HESAP VERİLERİ VE SİLME
// ============================================================

/**
 * Kullanıcının tüm verilerini dışa aktar
 * @returns {Promise<Object>} Veriler
 */
export async function exportUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Kullanıcı girişi gerekli');

    const userId = user.id;
    const result = {
        exported_at: new Date().toISOString(),
        user: {
            id: userId,
            email: user.email,
            phone: user.phone,
            metadata: user.user_metadata || {}
        }
    };

    const safeSelect = async (label, run) => {
        try {
            const { data, error } = await run();
            if (error) throw error;
            result[label] = data || [];
        } catch (err) {
            result[label] = { error: err.message };
        }
    };

    await safeSelect('profile', () => supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single());

    await safeSelect('listings', () => supabase
        .from('listings')
        .select('*')
        .eq('user_id', userId));

    await safeSelect('favorites', () => supabase
        .from('favorites')
        .select('*, listings (*)')
        .eq('user_id', userId));

    await safeSelect('messages', () => supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false }));

    await safeSelect('sessions', () => supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }));

    return result;
}

/**
 * Hesabı ve ilişkili verileri temizle (anon anahtarı ile sınırlı)
 * @returns {Promise<void>}
 */
export async function deleteAccountPermanently() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Kullanıcı girişi gerekli');

    const userId = user.id;

    const deletions = [
        () => supabase.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
        () => supabase.from('favorites').delete().eq('user_id', userId),
        () => supabase.from('listings').delete().eq('user_id', userId),
        () => supabase.from('user_sessions').delete().eq('user_id', userId),
        () => supabase.from('profiles').delete().eq('id', userId)
    ];

    for (const run of deletions) {
        try {
            const { error } = await run();
            if (error) console.warn('Silme adımı uyarısı:', error.message);
        } catch (err) {
            console.warn('Silme adımı hatası:', err.message);
        }
    }

    // Auth kaydını tamamen silmek için service role gerekir; burada metadata işaretlenir
    await supabase.auth.updateUser({
        data: {
            deleted: true,
            deleted_at: new Date().toISOString()
        }
    }).catch(err => console.warn('Auth metadata güncellenemedi:', err.message));

    await supabase.auth.signOut();
}

/**
     * Kategorileri getir (Cache sadece hata durumunda fallback olarak kullanılır)
     * @returns {Promise<Array>} Kategori listesi
     */
export async function getCategories() {
    const cachedData = localStorage.getItem('categories_cache');

    // Supabase'den her zaman güncel veriyi çek
    console.log('Kategoriler Supabase\'den çekiliyor...');
    const { data: categories, error } = await supabase
        .from('categories')
        .select('*')
        .order('id'); // ID sırasına göre, veya level/sıra

    if (error) {
        console.error('Kategori çekme hatası:', error);
        // Hata durumunda cache varsa eskisini döndür (fallback)
        if (cachedData) {
            try {
                const { data } = JSON.parse(cachedData);
                console.log('Kategoriler çevrimdışı önbellekten yüklendi (Fallback)');
                return data;
            } catch(e) { /* ignore */ }
        }
        throw error;
    }

    // Cache'i her başarılı istekte güncelle
    if (categories && categories.length > 0) {
        localStorage.setItem('categories_cache', JSON.stringify({
            data: categories,
            timestamp: Date.now()
        }));
    }

    return categories;
}
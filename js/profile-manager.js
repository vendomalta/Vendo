// Profile Management - Kullanıcı profil yönetimi
import { supabase } from './supabase.js';
const DEFAULT_AVATAR_URL = 'assets/images/default-avatar.svg';

/**
 * Kullanıcı profilini getir
 * @param {String} userId - Kullanıcı ID'si (opsiyonel)
 * @returns {Promise<Object>} Profil bilgileri
 */
export async function getProfile(userId = null) {
    let targetUserId = userId;
    
    if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Kullanıcı girişi gerekli');
        targetUserId = user.id;
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

    if (error && error.code === 'PGRST116') {
        // Profil yoksa oluştur (Trigger ve Frontend arasındaki yarış durumunu çöz)
        try {
            return await createProfile(targetUserId);
        } catch (createErr) {
            // Eğer "duplicate key value violates unique constraint" veya benzeri ise (23505),
            // demek ki Postgres trigger'ı profili bizden önce oluşturdu.
            // Tekrar çekmeyi deneyelim.
            const { data: retryProfile, error: retryError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', targetUserId)
                .single();
                
            if (!retryError && retryProfile) {
                return retryProfile;
            }
            throw createErr;
        }
    }

    if (error) throw error;

    // UI için anlık doğrulama bilgisini auth session'dan kontrol et (Sync garantisi)
    if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            profile.email_verified = !!user.email_confirmed_at;
            profile.phone_verified = !!user.phone_confirmed_at;
        }
    }

    return profile;
}

/**
 * Profil oluştur (otomatik)
 * @param {String} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} Oluşturulan profil
 */
async function createProfile(userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Kullanıcı girişi gerekli');

    // Bazı kolonlarda NOT NULL kısıtı var (örn. city). Supabase'den dönen metadata boş gelse bile
    // bu alanları en azından boş string ile dolduruyoruz ki ekleme hataya düşmesin.
    const profileData = {
        id: userId,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı',
        email: user.email,
        phone: user.user_metadata?.phone || '',
        // Varsayılan profil fotoğrafı
        avatar_url: user.user_metadata?.avatar_url || DEFAULT_AVATAR_URL,
        bio: '',
        city: user.user_metadata?.city || '',
        district: user.user_metadata?.district || '',
        birth_date: null,
        terms_accepted: user.user_metadata?.terms_accepted || false,
        email_verified: user.email_confirmed_at ? true : false,
        phone_verified: user.phone_confirmed_at ? true : false,
        identity_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
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

    // Güncelleme tarihini ekle
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Avatar fotoğrafı yükle
 * @param {File} file - Yüklenecek dosya
 * @returns {Promise<String>} Avatar URL'si
 */
export async function uploadAvatar(file) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('Kullanıcı girişi gerekli');

    // Dosya boyut kontrolü (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        throw new Error('Dosya boyutu 2MB\'dan küçük olmalıdır');
    }

    // Dosya tipi kontrolü
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Sadece JPG, PNG ve WEBP formatları desteklenmektedir');
    }

    // Dosya adını benzersiz yap
    const fileExt = file.name.split('.').pop();
    const fileName = `avatars/${user.id}_${Date.now()}.${fileExt}`;

    // Eski avatar'ı sil (varsa)
    const profile = await getProfile();
    if (profile?.avatar_url) {
        try {
            const oldPath = profile.avatar_url.split('/avatars/')[1];
            if (oldPath) {
                await supabase.storage
                    .from('profile-photos')
                    .remove([`avatars/${oldPath}`]);
            }
        } catch (e) {
            console.warn('Eski avatar silinemedi:', e);
        }
    }

    // Yeni avatar'ı yükle
    const { data, error } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (error) throw error;

    // Public URL al
    const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

    // Profilde güncelle
    await updateProfile({ avatar_url: publicUrl });

    return publicUrl;
}

/**
 * Kullanıcı istatistiklerini getir
 * @returns {Promise<Object>} İstatistikler
 */
export async function getUserStats() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('Kullanıcı girişi gerekli');

    // Aktif ilanlar
    const { count: activeCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active');

    // Toplam ilanlar
    const { count: totalCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

    // Değerlendirmeler (eğer reviews tablosu varsa)
    let reviewCount = 0;
    let averageRating = 0;
    
    try {
        const { count } = await supabase
            .from('seller_ratings')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', user.id);
        
        reviewCount = count || 0;

        if (reviewCount > 0) {
            const { data: reviews } = await supabase
                .from('seller_ratings')
                .select('rating')
                .eq('seller_id', user.id);
            
            if (reviews && reviews.length > 0) {
                const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
                averageRating = (sum / reviews.length).toFixed(1);
            }
        }
    } catch (e) {
        // Reviews tablosu yoksa devam et
        console.warn('Reviews tablosu bulunamadı');
    }

    return {
        activeAds: activeCount || 0,
        totalAds: totalCount || 0,
        reviews: reviewCount,
        averageRating: averageRating
    };
}

/**
 * Profil doğrulama durumu güncelle
 * @param {String} verificationType - 'email', 'phone', 'identity'
 * @param {Boolean} status - Doğrulama durumu
 * @returns {Promise<Object>} Güncellenmiş profil
 */
export async function updateVerificationStatus(verificationType, status) {
    const updates = {};
    
    switch (verificationType) {
        case 'email':
            updates.email_verified = status;
            break;
        case 'phone':
            updates.phone_verified = status;
            break;
        case 'identity':
            updates.identity_verified = status;
            break;
        default:
            throw new Error('Geçersiz doğrulama tipi');
    }

    return await updateProfile(updates);
}

// Export tüm fonksiyonlar
export default {
    getProfile,
    updateProfile,
    uploadAvatar,
    getUserStats,
    updateVerificationStatus
};

// Profile Management - User profile management
import { supabase } from './supabase.js';
const DEFAULT_AVATAR_URL = 'assets/images/default-avatar.svg';

/**
 * Get user profile
 * @param {String} userId - User ID (optional)
 * @returns {Promise<Object>} Profile information
 */
export async function getProfile(userId = null) {
    let targetUserId = userId;
    
    if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User login required');
        targetUserId = user.id;
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

    if (error && error.code === 'PGRST116') {
        // Create profile if it doesn't exist (Resolve race condition between Trigger and Frontend)
        try {
            return await createProfile(targetUserId);
        } catch (createErr) {
            // If it's a "duplicate key value violates unique constraint" or similar (23505),
            // it means the Postgres trigger created the profile before us.
            // Let's try fetching again.
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
 * Create profile (automatic)
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Created profile
 */
async function createProfile(userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User login required');

    // Bazı kolonlarda NOT NULL kısıtı var (örn. city). Supabase'den dönen metadata boş gelse bile
    // bu alanları en azından boş string ile dolduruyoruz ki ekleme hataya düşmesin.
    const profileData = {
        id: userId,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
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
 * Update profile
 * @param {Object} updates - Fields to be updated
 * @returns {Promise<Object>} Updated profile
 */
export async function updateProfile(updates) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('User login required');

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
    
    if (!user) throw new Error('User login required');

    // Dosya boyut kontrolü (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        throw new Error('File size must be less than 2MB');
    }

    // Dosya tipi kontrolü
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPG, PNG and WEBP formats are supported');
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
    
    if (!user) throw new Error('User sign in required');

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
        // If reviews table not found, continue
        console.warn('Reviews table not found');
    }

    return {
        activeAds: activeCount || 0,
        totalAds: totalCount || 0,
        reviews: reviewCount,
        averageRating: averageRating
    };
}

/**
 * Update profile verification status
 * @param {String} verificationType - 'email', 'phone', 'identity'
 * @param {Boolean} status - Verification status
 * @returns {Promise<Object>} Updated profile
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
            throw new Error('Invalid verification type');
    }

    return await updateProfile(updates);
}

// Export all functions
export default {
    getProfile,
    updateProfile,
    uploadAvatar,
    getUserStats,
    updateVerificationStatus
};

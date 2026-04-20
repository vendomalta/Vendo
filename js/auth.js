// js/auth.js - GÜNCELLENMİŞ VERSİYON (Security Features Added)
import { supabase } from './supabase.js'
import { getProfile } from './profile-manager.js'
import { 
  logLoginSuccess, 
  logLoginFailed, 
  logLogout,
  trackFailedLogin,
  clearFailedLoginCounter,
  logMultipleFailedLogins
} from './security-logging.js'
import { getCSRFToken, injectCSRFMetaTag } from './csrf-protection.js'
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginRateLimit
} from './rate-limiter.js'

const DEFAULT_AVATAR_URL = '/assets/images/default-avatar.svg';

// Kullanıcı ve profil bilgisini geçici hafızada tut
let currentSession = null;
let currentProfile = null;

// UI Güncelleme Fonksiyonu (Merkezi Kontrol)
function updateAuthUI() {
    // Butonları bulmaya çalış
    const authButtons = document.querySelector('.auth-buttons');
    const userMenu = document.querySelector('.user-menu');
    const adminBtn = document.getElementById('adminLoginBtn');

    // Eğer Header henüz yüklenmediyse ve butonları bulamadıysak DUR.
    if (!authButtons && !userMenu) {
        // Henüz işlem yapma, headerLoaded olayını bekle.
        return; 
    }

    // Header gelmiş, şimdi duruma göre boyayalım:
    if (currentSession) {
        // --- KULLANICI GİRİŞ YAPMIŞ ---
        if (authButtons) authButtons.style.display = 'none';
        if (userMenu) {
            userMenu.style.display = 'flex';
            
            // İsmi bul ve yaz (Metadata yoksa emailin başını al)
            const name = currentProfile?.full_name || currentSession.user.user_metadata?.full_name || currentSession.user.email.split('@')[0];
            const avatarUrl = currentProfile?.avatar_url || DEFAULT_AVATAR_URL;
            
            const nameEl = userMenu.querySelector('.user-name');
            const emailEl = userMenu.querySelector('.user-email');
            const avatarSmallEl = userMenu.querySelector('.user-button .avatar');
            const avatarLargeEl = userMenu.querySelector('.user-avatar');
            
            if (nameEl) nameEl.textContent = name;
            if (emailEl) emailEl.textContent = currentSession.user.email;
            if (avatarSmallEl) avatarSmallEl.src = avatarUrl;
            if (avatarLargeEl) avatarLargeEl.src = avatarUrl;

            // Admin butonu göster/gizle
            if (adminBtn && currentProfile?.is_admin) {
                adminBtn.style.display = 'inline-block';
            }
        }
    } else {
        // --- KULLANICI GİRİŞ YAPMAMIŞ ---
        if (authButtons) authButtons.style.display = 'flex';
        if (userMenu) userMenu.style.display = 'none';
        if (adminBtn) adminBtn.style.display = 'none';
    }
}

// Profil bilgisini getir
async function loadProfile() {
    if (!currentSession) return;
    try {
        // Profil yoksa otomatik oluşturacak
        const profile = await getProfile(currentSession.user.id);
        currentProfile = profile;
        
        // --- GUARD MANTIĞI: Profil eksikse complete-profile.html'ye at ---
        const currentPath = window.location.pathname.split('/').pop() || '/';
        const publicPages = ['login.html', 'reset-password.html'];
        
        const hasPhone = profile.phone && profile.phone.trim().length > 0;
        const hasCity = profile.city && profile.city.trim().length > 0;
        
        // Metadata'dan veya profil tablosundan kontrol et (Sync garantisi)
        const hasAcceptedTerms = currentSession.user.user_metadata?.terms_accepted || profile.terms_accepted;
        
        // Manuel kayıt olanlar (OAuth olmayanlar) genellikle bu bilgilere sahiptir.
        // Google kullanıcıları ise bu bilgileri tamamlamalıdır.
        const isProfileIncomplete = !hasPhone || !hasAcceptedTerms;

        if (currentPath === 'complete-profile.html') {
            if (!isProfileIncomplete) {
                console.log('Profile looks complete, redirecting to homepage...');
                window.location.href = '/';
                return;
            }
        } else if (!publicPages.includes(currentPath)) {
            if (isProfileIncomplete) {
                const isSocialLogin = currentSession.user.app_metadata?.provider !== 'email';
                console.warn(`${isSocialLogin ? 'Social' : 'Email'} login: Missing profile information detected.`);
                window.location.href = 'complete-profile.html';
                return;
            }
        }
        // ------------------------------------------------------------------

        updateAuthUI();
    } catch (err) {
        console.error('Profile info could not be retrieved:', err);
    }
}

// 1. Supabase durum değişikliğini dinle
supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session; // Bilgiyi kaydet
    currentProfile = null;
    if (session) {
        loadProfile();
        initHeartbeat(); // Heartbeat'i başlat
    } else {
        stopHeartbeat(); // Heartbeat'i durdur
    }
    updateAuthUI(); // Ekranı güncellemeyi dene
});

let heartbeatInterval = null;

// Heartbeat - Kullanıcının çevrimiçi olduğunu bildirir ve bildirim bayrağını sıfırlar
async function initHeartbeat() {
    if (heartbeatInterval) return;

    const updatePresence = async () => {
        if (!currentSession) return;
        try {
            const { error } = await supabase.auth.updateUser({
                data: { 
                    last_seen: new Date().toISOString(),
                    is_notified_offline: false 
                }
            });
            if (error) console.error('Heartbeat error:', error);
        } catch (err) {
            console.error('Heartbeat failed:', err);
        }
    };

    // Hemen ilk güncellemeyi yap
    updatePresence();
    
    // Her 2 dakikada bir tekrarla
    heartbeatInterval = setInterval(updatePresence, 120000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// 2. Header yüklendi sinyalini dinle (layout.js'den gelir)
document.addEventListener('headerLoaded', () => {
    // Header yeni geldi, elimizdeki oturum bilgisiyle tekrar boyayalım
    updateAuthUI(); 
});

// ===== KAYIT VE GİRİŞ FONKSİYONLARI =====

// Yeni kullanıcı kayıt et
window.register = async () => {
    console.log('🔵 Register function called');
    
    const firstName = document.getElementById('signupFirstName')?.value?.trim() || '';
    const lastName = document.getElementById('signupLastName')?.value?.trim() || '';
    const username = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || '');
    const email = document.getElementById('signupEmail')?.value || '';
    const password = document.getElementById('signupPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    const phone = document.getElementById('signupPhone')?.value || '';
    const countryCode = document.getElementById('signupCountryCode')?.value || '';

    const fullPhone = countryCode ? `+${countryCode} ${phone}` : phone;

    console.log('📝 Form values:', { username, email, password: password ? '***' : 'EMPTY', phone: fullPhone });

    // Validation
    if (!username || !email || !password) {
        console.error('❌ Missing fields');
        showNotification('Please fill in all fields!', 'error');
        return;
    }

    if (password !== confirmPassword) {
        console.error('❌ Passwords do not match');
        showNotification('Passwords do not match!', 'error');
        return;
    }

    if (password.length < 6) {
        console.error('❌ Password too short');
        showNotification('Password must be at least 6 characters long!', 'error');
        return;
    }

    console.log('✅ Validation successful, sending request to Supabase...');

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: username,
                    first_name: firstName,
                    last_name: lastName,
                    phone: fullPhone,
                    phone_prefix: countryCode ? `+${countryCode}` : '',
                    phone_number: phone,
                    terms_accepted: true // Manual registrants must check terms to submit
                }
            }
        });

        if (error) {
            console.error('❌ Supabase error:', error);
            throw error;
        }

        console.log('✅ Registration successful:', data);
        
        if (data.user && !data.user.email_confirmed_at) {
            // New OTP Flow: Redirect to verification page
            console.log('➡️ Redirecting to verification page...');
            const params = new URLSearchParams(window.location.search);
            const redirectUrl = params.get('redirect') || '/';
            const catId = params.get('catId');
            
            let verifyUrl = `verify-account.html?redirect=${encodeURIComponent(redirectUrl)}`;
            if (catId) verifyUrl += `&catId=${catId}`;
            
            window.location.href = verifyUrl;
        } else {
            showNotification('✅ Registration successful! You can now log in.', 'success');
            // Switch to login tab
            const loginTab = document.querySelector('[data-tab="login"]');
            if (loginTab) loginTab.click();
        }
    } catch (error) {
        console.error('❌ Registration error:', error);
        showNotification('❌ Registration failed: ' + error.message, 'error');
    }
};

// Kullanıcı giriş yap
window.login = async () => {
    console.log('🔵 Login function called');
    
    // Login formundaki ID'ler loginEmail, loginPassword veya email, password
    const email = document.getElementById('loginEmail')?.value || document.getElementById('email')?.value || '';
    const password = document.getElementById('loginPassword')?.value || document.getElementById('password')?.value || '';

    console.log('📝 Form values:', { email, password: password ? '***' : 'EMPTY' });

    if (!email || !password) {
        console.error('❌ Email or password empty');
        showNotification('Please enter email and password!', 'error');
        return;
    }

    const rateLimitCheck = checkLoginRateLimit(email);
    if (rateLimitCheck.limited) {
        console.error('❌ Rate limit exceeded:', rateLimitCheck);
        showNotification(rateLimitCheck.message, 'error');
        return;
    }

    const csrfToken = getCSRFToken();
    if (!csrfToken) {
        console.error('❌ CSRF token missing');
        showNotification('Security error. Please refresh the page.', 'error');
        return;
    }

    console.log('✅ Validation successful, sending login request to Supabase...');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('❌ Supabase error:', error);
            // ✅ Record failed attempt & check rate limit
            recordFailedLogin(email);
            await logLoginFailed(email, error.message);
            
            const newCheck = checkLoginRateLimit(email);
            if (newCheck.limited) {
                showNotification(`❌ Login failed.\n\n⏱️ Wait ${newCheck.minutesRemaining} minutes.`, 'error');
            } else {
                showNotification(`❌ Login failed.\n${newCheck.message}`, 'error');
            }
            throw error;
        }

        console.log('✅ Login successful!', data);
        
        if (data.user && !data.user.email_confirmed_at) {
            console.log('⚠️ Email not verified. Redirecting to OTP verification...');
            const params = new URLSearchParams(window.location.search);
            const redirectUrl = params.get('redirect') || '/';
            const catId = params.get('catId');
            
            let verifyUrl = `verify-account.html?redirect=${encodeURIComponent(redirectUrl)}`;
            if (catId) verifyUrl += `&catId=${catId}`;
            
            window.location.href = verifyUrl;
            return;
        }
        
        // ✅ Clear rate limit & log success
        clearLoginRateLimit(email);
        await logLoginSuccess(email, 'email');

        // Check for redirect URL in params
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect');
        
        if (redirectUrl) {
            console.log('➡️ Redirecting to:', redirectUrl);
            window.location.href = redirectUrl;
        } else {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('❌ Login error:', error);
    }
};

// Çıkış yap fonksiyonu (Global erişim için window'a atıyoruz)
window.handleLogout = async () => {
    try {
        // Log logout event
        await logLogout();
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Even if logging fails, still logout
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    }
}

// Social Login Yönlendirmesi
window.socialLogin = async (provider) => {
    try {
        if (provider === 'facebook') {
            console.log('🔵 Facebook login is temporarily disabled.');
            showNotification('Facebook login will be active soon. Please continue with Google or email.', 'info');
            return; // Çıkış yap ve devam etme
        }

        console.log(`🔵 Starting login with ${provider}...`);
        // Check for redirect URL in current page params
        const params = new URLSearchParams(window.location.search);
        const redirectParam = params.get('redirect');
        const redirectTo = redirectParam 
            ? `${window.location.origin}/${redirectParam}` 
            : `${window.location.origin}/`;

        // Supabase OAuth
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: redirectTo,
                queryParams: {
                    prompt: 'select_account' // Her seferinde hesap seçme ekranını zorla
                }
            }
        });

        if (error) {
            console.error('❌ Social login start error:', error);
            showNotification(`Could not start login with ${provider}: ${error.message}`, 'error');
            throw error;
        }

        // Redirects are handled automatically by Supabase OAuth on success.
    } catch (error) {
        console.error('❌ Social login system error:', error);
    }
};
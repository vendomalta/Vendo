import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm'

// --- Config resolution helpers ---
function isDevHost() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
}

function getMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute('content') : '';
}

function readSupabaseConfig() {
    // Priority: window.__SUPABASE -> meta tags -> hardcoded fallback
    const w = window || {};
    const winCfg = (w.__SUPABASE && typeof w.__SUPABASE === 'object') ? w.__SUPABASE : {};
    const metaUrl = getMeta('supabase-url');
    const metaKey = getMeta('supabase-key');
    const FALLBACK_URL = ''; // Required: Set via meta tag or window.__SUPABASE
    const FALLBACK_KEY = ''; // Required: Set via meta tag or window.__SUPABASE

    const url = winCfg.url || metaUrl || FALLBACK_URL;
    const key = winCfg.key || metaKey || FALLBACK_KEY;

    if (!url || !key) {
        console.error('[supabase] CRITICAL: Supabase URL or Key is missing. Check Meta tags.');
    }
    
    if (isDevHost() && (!winCfg.url && !metaUrl)) {
        console.warn('[supabase] Meta or window.__SUPABASE not found, using fallback config.');
    }
    return { url, key };
}

function getPreferredStorage() {
    // Default: localStorage, but fall back to sessionStorage if localStorage blocked
    // You can toggle persistence by setting localStorage['verde_persist'] = 'session'
    const pref = (localStorage.getItem('verde_persist') || 'local').toLowerCase();
    const tryStor = (s) => {
        try {
            const k = '__test__';
            s.setItem(k, '1'); s.removeItem(k);
            return s;
        } catch (_) { return null; }
    };
    if (pref === 'session') {
        return tryStor(sessionStorage) || tryStor(localStorage) || sessionStorage;
    }
    return tryStor(localStorage) || tryStor(sessionStorage) || localStorage;
}

const { url: SUPABASE_URL, key: SUPABASE_KEY } = readSupabaseConfig();

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: (localStorage.getItem('verde_persist') || 'local') !== 'session',
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: getPreferredStorage()
    }
});

// Make supabase globally accessible for non-module scripts
window.supabase = supabase;

// --- Auth state bridge: emit simple global events ---
try {
    supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user || null;
        const detail = { event, user, session };
        window.dispatchEvent(new CustomEvent('authChanged', { detail }));
        if (isDevHost()) {
            console.log(`[auth] ${event}`, user ? `uid=${user.id}` : '(no user)');
        }
        // Body class for quick CSS hooks
        document.body.classList.toggle('auth-logged-in', !!user);
    });
} catch (_) {}

// ✅ Development-only log
if (isDevHost()) {
    console.log('✅ Supabase ready');
}

// Convenience helpers
export async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
}

export async function signOutAndClean() {
    try {
        await supabase.auth.signOut();
    } finally {
        try {
            // App-specific ephemeral keys can be cleared here if needed
            // localStorage.removeItem('some_app_key');
        } catch (_) {}
    }
}

// --- Phone OTP Auth (SMS) ---
// Kullanıcı telefon ile giriş yapmak istediğinde OTP gönderir.
export async function requestPhoneOtp(phone, options = {}) {
    // Beklenen format: +90XXXXXXXXXX
    if (!phone || !/^\+\d{10,15}$/.test(phone)) {
        return { error: { message: 'Enter a valid phone number (e.g., +905XXXXXXXXX)' } };
    }
    try {
        const { data, error } = await supabase.auth.signInWithOtp({
            phone,
            options: {
                // Yeni kullanıcı oluşturulabilir
                shouldCreateUser: true,
                ...options
            }
        });
        return { data, error };
    } catch (err) {
        return { error: { message: err.message || 'OTP could not be sent' } };
    }
}

// Kullanıcı SMS ile gelen kodu doğrular.
export async function verifyPhoneOtp(phone, token) {
    if (!phone || !token) {
        return { error: { message: 'Phone and verification code are required' } };
    }
    try {
        const { data, error } = await supabase.auth.verifyOtp({
            type: 'sms',
            phone,
            token
        });
        return { data, error };
    } catch (err) {
        return { error: { message: err.message || 'OTP could not be verified' } };
    }
}
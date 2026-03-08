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
    const FALLBACK_URL = 'https://sxtfbxgeatfzjzsobjmq.supabase.co';
    const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4dGZieGdlYXRmemp6c29iam1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTM1NjIsImV4cCI6MjA4MzI4OTU2Mn0.547hJ_d0ETKIio_CP5aXatGruZrhpZC-nI2LZYKAYJo';

    const url = winCfg.url || metaUrl || FALLBACK_URL;
    const key = winCfg.key || metaKey || FALLBACK_KEY;

    if (isDevHost() && (!winCfg.url && !metaUrl)) {
        console.warn('[supabase] Meta veya window.__SUPABASE bulunamadı, fallback config kullanılıyor.');
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
    console.log('✅ Supabase hazır');
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
        return { error: { message: 'Geçerli telefon numarası girin (örn: +905XXXXXXXXX)' } };
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
        return { error: { message: err.message || 'OTP gönderilemedi' } };
    }
}

// Kullanıcı SMS ile gelen kodu doğrular.
export async function verifyPhoneOtp(phone, token) {
    if (!phone || !token) {
        return { error: { message: 'Telefon ve doğrulama kodu gerekli' } };
    }
    try {
        const { data, error } = await supabase.auth.verifyOtp({
            type: 'sms',
            phone,
            token
        });
        return { data, error };
    } catch (err) {
        return { error: { message: err.message || 'OTP doğrulanamadı' } };
    }
}
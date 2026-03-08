// js/csrf-protection.js - CSRF (Cross-Site Request Forgery) Koruması
// Tüm form submission'larını ve API call'larını protect et

import { supabase } from './supabase.js';

// ===== CSRF TOKEN YÖNETIMI =====

/**
 * Benzersiz CSRF token oluştur
 */
export function generateCSRFToken() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return token;
}

/**
 * CSRF token'ı session'da sakla
 */
export function storeCSRFToken(token) {
  sessionStorage.setItem('csrf_token', token);
  return token;
}

/**
 * Session'dan CSRF token'ı getir
 */
export function getCSRFToken() {
  let token = sessionStorage.getItem('csrf_token');
  
  if (!token) {
    // Token yoksa yeni bir tane oluştur
    token = generateCSRFToken();
    storeCSRFToken(token);
  }
  
  return token;
}

/**
 * CSRF token'ı doğrula
 */
export function validateCSRFToken(token) {
  const storedToken = getCSRFToken();
  return token === storedToken;
}

// ===== META TAG YÖNETIMI =====

/**
 * HTML'e CSRF token'ı meta tag'ında ekle
 */
export function injectCSRFMetaTag() {
  const token = getCSRFToken();
  
  // Mevcut meta tag'ı kontrol et
  let metaTag = document.querySelector('meta[name="csrf-token"]');
  
  if (!metaTag) {
    // Meta tag oluştur
    metaTag = document.createElement('meta');
    metaTag.name = 'csrf-token';
    metaTag.content = token;
    document.head.appendChild(metaTag);
  } else {
    // Var olanı güncelle
    metaTag.content = token;
  }
  
  console.log('✅ CSRF meta tag injected');
}

/**
 * Meta tag'dan CSRF token'ı oku
 */
export function getCSRFTokenFromMetaTag() {
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag ? metaTag.getAttribute('content') : null;
}

// ===== FORM PROTECTION =====

/**
 * Form submission'ında CSRF token'ı otomatik ekle
 */
export function protectAllForms() {
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    // CSRF token input'u ekle (eğer yoksa)
    const existingInput = form.querySelector('input[name="csrf_token"]');
    
    if (!existingInput) {
      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = 'csrf_token';
      csrfInput.value = getCSRFToken();
      form.appendChild(csrfInput);
    }
    
    // Form submit'ine event listener ekle
    form.addEventListener('submit', validateFormSubmission);
  });
  
  console.log(`✅ ${forms.length} form protected with CSRF tokens`);
}

/**
 * Form submission'ını doğrula
 */
export function validateFormSubmission(event) {
  const form = event.target;
  const csrfToken = form.querySelector('input[name="csrf_token"]')?.value;
  
  if (!csrfToken || !validateCSRFToken(csrfToken)) {
    event.preventDefault();
    console.error('❌ CSRF token validation failed');
    showNotification('Güvenlik doğrulaması başarısız. Lütfen sayfayı yenileyin.', 'error');
    return false;
  }
  
  console.log('✅ Form CSRF validation passed');
  return true;
}

// ===== API REQUEST PROTECTION =====

/**
 * Protected fetch fonksiyonu
 * Tüm API call'larına CSRF token'ı ekle
 */
export async function protectedFetch(url, options = {}) {
  const csrfToken = getCSRFToken();
  
  // Headers'ı hazırla
  const headers = {
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Request'i yap
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Response'ı kontrol et
  if (response.status === 403) {
    console.error('❌ CSRF token invalid - 403 Forbidden');
    throw new Error('CSRF token invalid');
  }
  
  return response;
}

/**
 * Protected Supabase RPC call
 */
export async function protectedSupabaseCall(functionName, params = {}) {
  const csrfToken = getCSRFToken();
  
  try {
    const { data, error } = await supabase.rpc(functionName, {
      ...params,
      csrf_token: csrfToken,
    });
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('❌ Supabase call error:', error);
    throw error;
  }
}

// ===== UI HELPERS =====

/**
 * Bildirim göster
 */
function showNotification(message, type = 'info') {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

// ===== INITIALIZATION =====

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', () => {
  // CSRF token'ı meta tag'a ekle
  injectCSRFMetaTag();
  
  // Tüm form'ları protect et
  protectAllForms();
  
  // Dinamik olarak eklenen form'ları da protect et
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'FORM') {
            // Yeni form bulundu
            const existingInput = node.querySelector('input[name="csrf_token"]');
            if (!existingInput) {
              const csrfInput = document.createElement('input');
              csrfInput.type = 'hidden';
              csrfInput.name = 'csrf_token';
              csrfInput.value = getCSRFToken();
              node.appendChild(csrfInput);
            }
            node.addEventListener('submit', validateFormSubmission);
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  console.log('✅ CSRF Protection initialized');
});

export default {
  generateCSRFToken,
  storeCSRFToken,
  getCSRFToken,
  validateCSRFToken,
  injectCSRFMetaTag,
  getCSRFTokenFromMetaTag,
  protectAllForms,
  protectedFetch,
  protectedSupabaseCall,
};

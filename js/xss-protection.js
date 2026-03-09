/**
 * ✅ XSS PROTECTION MODULE
 * DOMPurify kullanarak tüm kullanıcı girdilerini temizler
 * 
 * @module xss-protection
 * @version 1.0.0
 * @created 2024
 */

/**
 * HTML içeriğini XSS'e karşı sanitize eder
 * @param {string} dirtyHTML - Temizlenecek HTML
 * @param {Object} options - DOMPurify seçenekleri
 * @returns {string} Temizlenmiş HTML
 */
export function sanitizeHTML(dirtyHTML, options = {}) {
    if (typeof DOMPurify === 'undefined') {
        console.warn('⚠️ DOMPurify is not loaded. Using basic fallback sanitization!');
        return fallbackSanitizeHTML(dirtyHTML);
    }

    const defaultOptions = {
        ALLOWED_TAGS: [
            'b', 'i', 'em', 'strong', 'u', 'a', 'p', 'br', 'span', 'div',
            'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'img', 'blockquote', 'code', 'pre'
        ],
        // data-* attributeleri (data-listing-id, data-href vb.) korunmalı, yoksa kart tıklamaları bozuluyor
        ALLOWED_ATTR: ['href', 'title', 'target', 'src', 'alt', 'class', 'id'],
        ALLOW_DATA_ATTR: true
    };

    const config = { ...defaultOptions, ...options };
    return DOMPurify.sanitize(dirtyHTML, config);
}

/**
 * Sadece metin içeriğini korur, tüm HTML etiketlerini kaldırır
 * @param {string} dirtyText - Temizlenecek metin
 * @returns {string} Sadece metin içeriği
 */
export function sanitizeText(dirtyText) {
    if (typeof DOMPurify === 'undefined') {
        return fallbackSanitizeText(dirtyText);
    }

    return DOMPurify.sanitize(dirtyText, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * URL'yi sanitize eder ve güvenli olup olmadığını kontrol eder
 * @param {string} url - Kontrol edilecek URL
 * @returns {string} Güvenli URL veya boş string
 */
export function sanitizeURL(url) {
    if (!url) return '';

    // Sadece http, https ve mailto protokollerine izin ver
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    
    try {
        const parsedURL = new URL(url);
        
        if (!allowedProtocols.includes(parsedURL.protocol)) {
            console.warn('⚠️ Blocked unsafe URL protocol:', parsedURL.protocol);
            return '';
        }
        
        return parsedURL.href;
    } catch (error) {
        // Geçersiz URL
        console.warn('⚠️ Invalid URL:', url);
        return '';
    }
}

/**
 * Kullanıcı adını sanitize eder
 * @param {string} username - Kullanıcı adı
 * @returns {string} Temizlenmiş kullanıcı adı
 */
export function sanitizeUsername(username) {
    if (!username) return '';
    
    // HTML etiketlerini kaldır ve sadece alfanumerik + temel karakterlere izin ver
    return sanitizeText(username).replace(/[^\w\s\-_.]/g, '');
}

/**
 * E-posta adresini sanitize eder
 * @param {string} email - E-posta adresi
 * @returns {string} Temizlenmiş e-posta
 */
export function sanitizeEmail(email) {
    if (!email) return '';
    
    // HTML etiketlerini kaldır
    const cleaned = sanitizeText(email);
    
    // Basit e-posta validasyonu
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(cleaned) ? cleaned : '';
}

/**
 * innerHTML kullanarak güvenli şekilde içerik ekler
 * @param {HTMLElement} element - Hedef element
 * @param {string} html - Eklenecek HTML
 * @param {Object} options - Sanitize seçenekleri
 */
export function safeInnerHTML(element, html, options = {}) {
    if (!element) {
        console.error('❌ Element not found for safeInnerHTML');
        return;
    }
    
    element.innerHTML = sanitizeHTML(html, options);
}

/**
 * textContent kullanarak güvenli şekilde metin ekler (daha güvenli)
 * @param {HTMLElement} element - Hedef element
 * @param {string} text - Eklenecek metin
 */
export function safeTextContent(element, text) {
    if (!element) {
        console.error('❌ Element not found for safeTextContent');
        return;
    }
    
    element.textContent = sanitizeText(text);
}

/**
 * Form inputlarını XSS'e karşı korur
 * @param {HTMLFormElement} form - Korunacak form
 */
export function protectFormInputs(form) {
    if (!form) return;
    
    const inputs = form.querySelectorAll('input[type="text"], input[type="email"], textarea');
    
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            this.value = sanitizeText(this.value);
        });
    });
}

/**
 * Kullanıcı verisini güvenli şekilde görüntüler
 * @param {Object} userData - Kullanıcı verisi
 * @returns {Object} Temizlenmiş kullanıcı verisi
 */
export function sanitizeUserData(userData) {
    if (!userData || typeof userData !== 'object') return {};
    
    const sanitized = {};
    
    for (const [key, value] of Object.entries(userData)) {
        if (typeof value === 'string') {
            // Özel alanlar için özel sanitizasyon
            if (key.toLowerCase().includes('email')) {
                sanitized[key] = sanitizeEmail(value);
            } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
                sanitized[key] = sanitizeURL(value);
            } else if (key.toLowerCase().includes('username') || key.toLowerCase().includes('name')) {
                sanitized[key] = sanitizeUsername(value);
            } else {
                sanitized[key] = sanitizeText(value);
            }
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            sanitized[key] = value;
        } else if (value === null || value === undefined) {
            sanitized[key] = value;
        } else if (typeof value === 'object') {
            // İç içe objeler için recursive sanitize
            sanitized[key] = sanitizeUserData(value);
        }
    }
    
    return sanitized;
}

/**
 * JSON verisini güvenli şekilde parse eder
 * @param {string} jsonString - JSON string
 * @returns {Object|null} Parse edilmiş ve sanitize edilmiş obje
 */
export function safeJSONParse(jsonString) {
    try {
        const parsed = JSON.parse(jsonString);
        return sanitizeUserData(parsed);
    } catch (error) {
        console.error('❌ Invalid JSON:', error);
        return null;
    }
}

/**
 * localStorage'dan güvenli şekilde veri okur
 * @param {string} key - Storage key
 * @returns {any} Sanitize edilmiş veri
 */
export function safeLocalStorageGet(key) {
    try {
        const value = localStorage.getItem(key);
        if (!value) return null;
        
        return safeJSONParse(value);
    } catch (error) {
        console.error('❌ Error reading from localStorage:', error);
        return null;
    }
}

/**
 * Markdown içeriğini güvenli HTML'e dönüştürür
 * @param {string} markdown - Markdown içerik
 * @returns {string} Sanitize edilmiş HTML
 */
export function sanitizeMarkdown(markdown) {
    if (!markdown) return '';
    
    // Basit markdown → HTML dönüşümü
    let html = markdown
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
        .replace(/\n/g, '<br>');
    
    // XSS'e karşı sanitize et
    return sanitizeHTML(html);
}

/**
 * DOMPurify yüklü mü kontrol eder
 * @returns {boolean}
 */
export function isDOMPurifyLoaded() {
    return typeof DOMPurify !== 'undefined';
}

/**
 * XSS korumasını başlatır
 */
export function initXSSProtection() {
    if (!isDOMPurifyLoaded()) {
        console.error('❌ DOMPurify is not loaded! XSS protection is disabled.');
        console.info('💡 Add this to your HTML: <script src="https://cdn.jsdelivr.net/npm/dompurify@latest/dist/purify.min.js"></script>');
        return false;
    }
    
    console.log('✅ XSS Protection initialized with DOMPurify');
    
    // Tüm formlarda input koruması
    document.querySelectorAll('form').forEach(form => {
        protectFormInputs(form);
    });
    
    return true;
}

// Sayfa yüklendiğinde XSS korumasını başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initXSSProtection);
} else {
    initXSSProtection();
}

// Global obje olarak export (console'dan test için)
window.XSSProtection = {
    sanitizeHTML,
    sanitizeText,
    sanitizeURL,
    sanitizeUsername,
    sanitizeEmail,
    safeInnerHTML,
    safeTextContent,
    sanitizeUserData,
    safeJSONParse,
    safeLocalStorageGet,
    sanitizeMarkdown,
    isDOMPurifyLoaded
};

/**
 * Fallback HTML Sanitization (Simple regex based)
 * @param {string} html 
 */
function fallbackSanitizeHTML(html) {
    if (!html) return '';
    // Remove scripts and dangerous attributes
    return html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/on\w+="[^"]*"/gim, "")
        .replace(/javascript:[^"]*/gim, "");
}

/**
 * Fallback Text Sanitization (Escaping)
 * @param {string} text 
 */
function fallbackSanitizeText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('✅ XSS Protection module loaded');

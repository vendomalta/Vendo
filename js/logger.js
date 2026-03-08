/**
 * ✅ PRODUCTION-READY LOGGER
 * Development ve production'da farklı davranış
 */

// Development modu kontrolü
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('dev');

// Toast notification göster
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Toast stilleri
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Renk ayarla
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    toast.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(toast);
    
    // 3 saniye sonra kaldır
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Logger object - merkezi log yönetimi
const logger = {
    /**
     * Debug log (development-only)
     */
    debug: (title, data) => {
        if (isDevelopment) {
            console.log(`🔍 ${title}`, data);
        }
    },

    /**
     * Info log (development-only)
     */
    info: (title, data) => {
        if (isDevelopment) {
            console.log(`ℹ️ ${title}`, data);
        }
    },

    /**
     * Success notification
     */
    success: (message, data) => {
        if (isDevelopment) {
            console.log(`✅ ${message}`, data);
        }
        // Production'da toast göster
        showToast(message, 'success');
    },

    /**
     * Warning (her zaman göster)
     */
    warn: (message, data) => {
        console.warn(`⚠️ ${message}`, data);
        showToast(message, 'warning');
    },

    /**
     * Error - her zaman log et
     */
    error: (title, error) => {
        console.error(`❌ ${title}`, error);
        
        // Kullanıcı dostu mesaj göster
        let userMessage = title;
        
        // Hata koduna göre kullanıcı mesajı oluştur
        if (error?.code === 'PGRST116') {
            userMessage = 'Bu işleme izniniz yok';
        } else if (error?.message?.includes('UNIQUE')) {
            userMessage = 'Bu kayıt zaten var';
        } else if (error?.message?.includes('JWT')) {
            userMessage = 'Oturum süresi doldu. Lütfen giriş yapınız';
        } else if (error?.message?.includes('Network')) {
            userMessage = 'İnternet bağlantısı kontrol edin';
        }
        
        showToast(userMessage, 'error');
        
        // Gerçek hataları Sentry'e gönderilebilir
        // (opsiyonel - sonradan eklenebilir)
    },

    /**
     * Toast only - sadece bildirim, log yok
     */
    toast: (message, type = 'info') => {
        showToast(message, type);
    }
};

export default logger;

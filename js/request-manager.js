/**
 * Request Manager - AbortController + Retry logic
 * Merkezi istek yönetimi: işlemleri iptal etme, yeniden deneme, timeout
 */

const activeRequests = new Map();

/**
 * Exponential backoff ile yeniden dene
 * @param {Function} fn - Çalıştırılacak async işlev
 * @param {number} maxRetries - Maksimum deneme sayısı (default: 3)
 * @param {number} initialDelayMs - İlk bekleme süresi (ms, default: 500)
 * @returns {Promise<*>} İşlev sonucu
 */
export async function withRetry(fn, maxRetries = 3, initialDelayMs = 500) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            // Yeniden denemeye değer miş mi kontrol et (ağ/timeout hataları)
            const isRetryable = !error.message || /timeout|network|econnrefused|enotfound|fetch|abort/i.test(error.message);
            if (!isRetryable || i === maxRetries - 1) {
                throw error;
            }
            // Exponential backoff: 500ms, 1s, 2s...
            const delay = initialDelayMs * Math.pow(2, i);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

/**
 * AbortController ile sarmalanmış istek yap
 * @param {string} key - İstek tanımlayıcı (ör. 'listings-main')
 * @param {Function} fn - İşlev (AbortSignal almayan normal async func)
 * @param {Object} options - { maxRetries, timeoutMs, ... }
 * @returns {Promise<*>} İşlev sonucu
 */
export async function managedRequest(key, fn, options = {}) {
    const { maxRetries = 2, timeoutMs = 30000 } = options;
    
    // Eski isteği iptal et (varsa)
    cancelRequest(key);
    
    const controller = new AbortController();
    activeRequests.set(key, controller);
    
    // Timeout ayarla
    let timeoutId = null;
    if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
            controller.abort();
        }, timeoutMs);
    }
    
    try {
        // fn'in içinde abortSignal kullanılabilmesi için wrapper'a geç (opsiyonel)
        return await withRetry(
            () => Promise.resolve(fn(controller.signal)),
            maxRetries
        );
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        activeRequests.delete(key);
    }
}

/**
 * Belirtilen isteği iptal et
 * @param {string} key - İstek tanımlayıcı
 */
export function cancelRequest(key) {
    const controller = activeRequests.get(key);
    if (controller) {
        controller.abort();
        activeRequests.delete(key);
    }
}

/**
 * Tüm aktif istekleri iptal et
 */
export function cancelAllRequests() {
    activeRequests.forEach(controller => controller.abort());
    activeRequests.clear();
}

/**
 * Basit timeout Promise'i
 * @param {number} ms - Milisaniye
 * @returns {Promise<void>}
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

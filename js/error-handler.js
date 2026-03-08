// Global Hata Yöneticisi
// Sayfa genelinde beklenmeyen hataları yakalar ve kullanıcıya toast ile bildirir.
import { showToast } from './toast.js';

const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

function sanitizeMessage(msg) {
  try {
    if (typeof msg === 'string') return msg.slice(0, 500);
    if (msg && msg.message) return String(msg.message).slice(0, 500);
    return 'Beklenmeyen hata oluştu';
  } catch (_) {
    return 'Beklenmeyen hata oluştu';
  }
}

export function reportError(error, context = '') {
  const message = sanitizeMessage(error);
  const prefix = context ? `[${context}] ` : '';
  showToast(`${prefix}${message}`, 'error', 5000);
  if (isDev) console.error('[error]', context, error);
}

window.addEventListener('error', (event) => {
  reportError(event.error || event.message || 'Hata', 'window.error');
});

window.addEventListener('unhandledrejection', (event) => {
  reportError(event.reason || 'İşlem tamamlanamadı', 'unhandledrejection');
});

// Global yardımcı export
export default { reportError };

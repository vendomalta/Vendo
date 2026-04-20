// Basit Toast Bildirim Yardımcısı
// Kullanım: showToast('Mesaj', 'success'|'error'|'info'|'warn', 3000)

const ensureContainer = () => {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    Object.assign(container.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });
    document.body.appendChild(container);
  }
  return container;
};

const palette = {
  success: { bg: 'rgba(236, 253, 245, 0.9)', border: '#10b981', text: '#065f46', icon: 'fas fa-check-circle' },
  error: { bg: 'rgba(254, 242, 242, 0.9)', border: '#ef4444', text: '#7f1d1d', icon: 'fas fa-exclamation-circle' },
  info: { bg: 'rgba(239, 246, 255, 0.9)', border: '#3b82f6', text: '#1e3a8a', icon: 'fas fa-info-circle' },
  warn: { bg: 'rgba(255, 251, 235, 0.9)', border: '#f59e0b', text: '#92400e', icon: 'fas fa-exclamation-triangle' }
};

export function showToast(message, type = 'info', duration = 3000) {
  const theme = palette[type] || palette.info;
  const container = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  Object.assign(toast.style, {
    background: theme.bg,
    backdropFilter: 'blur(8px)',
    webkitBackdropFilter: 'blur(8px)',
    border: `1px solid ${theme.border}40`, // Lower opacity border
    borderLeft: `4px solid ${theme.border}`,
    color: theme.text,
    borderRadius: '16px',
    padding: '12px 16px',
    minWidth: '280px',
    maxWidth: '400px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transform: 'translateX(20px)',
    opacity: '0',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    pointerEvents: 'auto',
    fontFamily: "'Inter', sans-serif"
  });

  const icon = document.createElement('i');
  icon.className = theme.icon;
  icon.style.color = theme.border;
  icon.style.fontSize = '18px';

  const text = document.createElement('span');
  text.textContent = String(message);
  text.style.flex = '1';
  text.style.fontSize = '14px';
  text.style.fontWeight = '600';

  const close = document.createElement('button');
  close.innerHTML = '×';
  Object.assign(close.style, {
    background: 'transparent',
    border: 'none',
    color: theme.text,
    fontSize: '20px',
    cursor: 'pointer',
    opacity: '0.5',
    padding: '0 4px',
    lineHeight: '1'
  });

  close.addEventListener('mouseenter', () => close.style.opacity = '1');
  close.addEventListener('mouseleave', () => close.style.opacity = '0.5');
  close.addEventListener('click', () => removeToast(toast));

  toast.append(icon, text, close);
  container.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 10);

  // Auto remove
  const timeout = setTimeout(() => removeToast(toast), duration);
  toast.dataset.timeoutId = timeout;

  return toast;
}

function removeToast(toast) {
  try {
    toast.style.transform = 'translateX(20px)';
    toast.style.opacity = '0';
    const id = toast.dataset.timeoutId;
    if (id) clearTimeout(Number(id));
    setTimeout(() => toast.remove(), 400);
  } catch (_) {}
}

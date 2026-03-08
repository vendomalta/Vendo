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
  success: { bg: '#ecfdf5', border: '#10b981', text: '#065f46', icon: '✓' },
  error: { bg: '#fef2f2', border: '#ef4444', text: '#7f1d1d', icon: '⚠' },
  info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a', icon: 'ℹ' },
  warn: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', icon: '!' }
};

export function showToast(message, type = 'info', duration = 3000) {
  const theme = palette[type] || palette.info;
  const container = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  Object.assign(toast.style, {
    background: theme.bg,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: '12px',
    padding: '10px 12px',
    minWidth: '240px',
    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transform: 'translateY(10px)',
    opacity: '0',
    transition: 'transform 180ms ease, opacity 180ms ease'
  });

  const icon = document.createElement('span');
  icon.textContent = theme.icon;
  icon.style.fontWeight = '700';

  const text = document.createElement('span');
  text.textContent = String(message);
  text.style.flex = '1';

  const close = document.createElement('button');
  close.textContent = '×';
  Object.assign(close.style, {
    background: 'transparent',
    border: 'none',
    color: theme.text,
    fontSize: '16px',
    cursor: 'pointer'
  });

  close.addEventListener('click', () => removeToast(toast));

  toast.append(icon, text, close);
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  // Auto remove
  const timeout = setTimeout(() => removeToast(toast), duration);
  toast.dataset.timeoutId = timeout;

  return toast;
}

function removeToast(toast) {
  try {
    toast.style.transform = 'translateY(10px)';
    toast.style.opacity = '0';
    const id = toast.dataset.timeoutId;
    if (id) clearTimeout(Number(id));
    setTimeout(() => toast.remove(), 180);
  } catch (_) {}
}

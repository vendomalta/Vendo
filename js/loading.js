// Basit Yükleme Overlay Yardımcısı
// showLoading('Metin') / hideLoading() / setProgress(0-100)

let overlay = null;
let spinner = null;

function ensure() {
  if (overlay) return overlay;

  // Keyframes for rotating logo (once)
  if (!document.getElementById('global-loading-keyframes')) {
    const style = document.createElement('style');
    style.id = 'global-loading-keyframes';
    style.textContent = `@keyframes loading-logo-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
  overlay = document.createElement('div');
  overlay.className = 'global-loading-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(255,255,255,0.65)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '9998',
    opacity: '0',
    transition: 'opacity 180ms ease'
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  });

  spinner = document.createElement('div');
  Object.assign(spinner.style, {
    width: '52px',
    height: '52px',
    backgroundImage: "url('assets/images/verde-logo.svg')",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'contain',
    animation: 'loading-logo-spin 1.2s linear infinite',
    filter: 'drop-shadow(0 6px 10px rgba(16,185,129,0.35))'
  });

  panel.appendChild(spinner);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  return overlay;
}

export function showLoading(_text) {
  ensure();
}

export function setProgress(_pct) {
  // Progress bar removed; spinner handles the motion.
  return;
}

export function hideLoading() {
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay?.remove();
    overlay = null;
    spinner = null;
  }, 180);
}

export default { showLoading, setProgress, hideLoading };

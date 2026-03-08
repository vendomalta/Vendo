// Scroll progress indicator for pages with vertical scroll
(() => {
    const bar = document.querySelector('.scroll-progress__bar');
    if (!bar) return;

    const clamp = (value) => Math.min(1, Math.max(0, value));

    const updateProgress = () => {
        const doc = document.documentElement;
        const scrollTop = doc.scrollTop || window.scrollY || 0;
        const height = doc.scrollHeight - doc.clientHeight;
        const progress = height > 0 ? clamp(scrollTop / height) : 0;
        bar.style.transform = `scaleX(${progress})`;
    };

    const scheduleUpdate = () => {
        window.requestAnimationFrame(updateProgress);
    };

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    updateProgress();
})();

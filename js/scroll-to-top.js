// Scroll to Top Button - Mobile
(function() {
    'use strict';

    function initScrollToTop() {
        // Only on mobile
        if (window.innerWidth > 768) return;

        // Create button
        const scrollBtn = document.createElement('button');
        scrollBtn.className = 'scroll-top-btn';
        scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
        scrollBtn.setAttribute('aria-label', 'Yukarı kaydır');
        scrollBtn.title = 'Yukarı kaydır';
        
        document.body.appendChild(scrollBtn);

        // Show/hide based on scroll position
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            
            if (window.scrollY > 300) {
                scrollBtn.classList.add('visible');
                
                // Auto-hide after 3 seconds
                scrollTimeout = setTimeout(() => {
                    if (window.scrollY > 300) {
                        scrollBtn.classList.remove('visible');
                    }
                }, 3000);
            } else {
                scrollBtn.classList.remove('visible');
            }
        }, { passive: true });

        // Click to scroll
        scrollBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

        // Show on scroll stop
        let isScrolling;
        window.addEventListener('scroll', () => {
            clearTimeout(isScrolling);
            isScrolling = setTimeout(() => {
                if (window.scrollY > 300) {
                    scrollBtn.classList.add('visible');
                }
            }, 150);
        }, { passive: true });
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollToTop);
    } else {
        initScrollToTop();
    }
})();

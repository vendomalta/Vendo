// Lazy Loading Images with Intersection Observer
(function() {
    'use strict';

    class LazyLoader {
        constructor() {
            this.imageObserver = null;
            this.cardObserver = null;
            this.init();
        }

        init() {
            this.setupImageObserver();
            this.setupCardObserver();
            this.observeExistingImages();
            this.observeExistingCards();
        }

        setupImageObserver() {
            const options = {
                root: null,
                rootMargin: '50px',
                threshold: 0.01
            };

            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        this.imageObserver.unobserve(entry.target);
                    }
                });
            }, options);
        }

        setupCardObserver() {
            const options = {
                root: null,
                rootMargin: '100px',
                threshold: 0.01
            };

            this.cardObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('lazy-loaded');
                        this.cardObserver.unobserve(entry.target);
                    }
                });
            }, options);
        }

        observeExistingImages() {
            document.querySelectorAll('img[data-src]').forEach(img => {
                this.imageObserver.observe(img);
            });
        }

        observeExistingCards() {
            document.querySelectorAll('.listing-card:not(.lazy-loaded)').forEach(card => {
                this.cardObserver.observe(card);
            });
        }

        loadImage(img) {
            const src = img.dataset.src;
            const srcset = img.dataset.srcset;

            if (!src) return;

            // Show loading placeholder
            img.classList.add('lazy-loading');

            // Create temporary image to check if load succeeds
            const tempImg = new Image();
            
            tempImg.onload = () => {
                img.src = src;
                if (srcset) {
                    img.srcset = srcset;
                }
                img.classList.remove('lazy-loading');
                img.classList.add('lazy-loaded');
                
                // Fade in effect
                img.style.opacity = '0';
                setTimeout(() => {
                    img.style.transition = 'opacity 0.3s ease';
                    img.style.opacity = '1';
                }, 10);
            };

            tempImg.onerror = () => {
                img.classList.remove('lazy-loading');
                img.classList.add('lazy-error');
                // Show placeholder or error image
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%23999" font-size="18"%3EGörsel yüklenemedi%3C/text%3E%3C/svg%3E';
            };

            tempImg.src = src;
        }

        // Public method to observe new images added dynamically
        observeNewImages() {
            this.observeExistingImages();
            this.observeExistingCards();
        }
    }

    // Global instance
    window.LazyLoader = new LazyLoader();

    // Re-observe when new content is added
    const observer = new MutationObserver(() => {
        if (window.LazyLoader) {
            window.LazyLoader.observeNewImages();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();

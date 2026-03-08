// Viewport Optimizer - Ekran ölçülerine göre otomatik optimizasyon
(function() {
    'use strict';

    class ViewportOptimizer {
        constructor() {
            this.breakpoints = {
                extraSmall: 360,
                small: 400,
                medium: 480,
                tablet: 768
            };
            
            this.init();
        }

        init() {
            this.optimizeViewport();
            
            // Ekran boyutu değiştiğinde yeniden optimize et
            let resizeTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    this.optimizeViewport();
                }, 150);
            });

            // Orientation change için
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    this.optimizeViewport();
                }, 200);
            });
        }

        optimizeViewport() {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const html = document.documentElement;

            // Mevcut class'ları temizle
            html.classList.remove('vw-xs', 'vw-sm', 'vw-md', 'vw-tablet', 'vw-desktop');

            // Ekran boyutuna göre class ekle
            if (width <= this.breakpoints.extraSmall) {
                html.classList.add('vw-xs');
                this.applyExtraSmallOptimizations();
            } else if (width <= this.breakpoints.small) {
                html.classList.add('vw-sm');
                this.applySmallOptimizations();
            } else if (width <= this.breakpoints.medium) {
                html.classList.add('vw-md');
                this.applyMediumOptimizations();
            } else if (width <= this.breakpoints.tablet) {
                html.classList.add('vw-tablet');
            } else {
                html.classList.add('vw-desktop');
            }

            // CSS custom properties güncelle
            html.style.setProperty('--vw-width', `${width}px`);
            html.style.setProperty('--vw-height', `${height}px`);
            html.style.setProperty('--vw-ratio', (width / height).toFixed(2));

            // Console log (debug için)
            console.log(`📱 Viewport Optimized: ${width}x${height}`, {
                class: html.className.match(/vw-\w+/)?.[0] || 'none',
                ratio: (width / height).toFixed(2)
            });
        }

        applyExtraSmallOptimizations() {
            // Ekstra küçük ekranlar için (<360px)
            console.log('🔧 Extra small optimization active');
            
            // Notification badge'leri gizle
            document.querySelectorAll('.notification-badge').forEach(badge => {
                badge.style.display = 'none';
            });
        }

        applySmallOptimizations() {
            // Küçük ekranlar için (360-400px)
            console.log('🔧 Small optimization active');
        }

        applyMediumOptimizations() {
            // Orta ekranlar için (400-480px)
            console.log('🔧 Medium optimization active');
        }

        // Dinamik font scaling
        scaleFontSize() {
            const width = window.innerWidth;
            const baseSize = 16;
            
            if (width <= 320) {
                document.documentElement.style.fontSize = '14px';
            } else if (width <= 360) {
                document.documentElement.style.fontSize = '15px';
            } else {
                document.documentElement.style.fontSize = `${baseSize}px`;
            }
        }
    }

    // DOM ready olduğunda başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new ViewportOptimizer();
        });
    } else {
        new ViewportOptimizer();
    }
})();

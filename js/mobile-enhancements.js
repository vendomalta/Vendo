// Mobile Enhancements - Touch gestures, bottom nav, pull-to-refresh hints
(function() {
    'use strict';

    class MobileEnhancements {
        constructor() {
            this.isMobile = window.innerWidth <= 768;
            this.touchStartX = 0;
            this.touchStartY = 0;
            this.touchEndX = 0;
            this.touchEndY = 0;
            this.initialized = false;
            
            if (this.isMobile) {
                this.init();
            }

            // Resize listener
            window.addEventListener('resize', () => {
                const wasMobile = this.isMobile;
                this.isMobile = window.innerWidth <= 768;
                
                // Initialize if transitioning to mobile
                if (this.isMobile && !wasMobile && !this.initialized) {
                    this.init();
                }
            });
        }

        init() {
            console.log('🟢 MobileEnhancements.init() called. isMobile:', this.isMobile);
            this.addTouchGestures();
            this.addPullToRefreshHint();
            this.addBottomNavigation();
            this.enhanceScrolling();
            this.addTapFeedback();
            this.initHomeParity();
            this.initialized = true;
            console.log('🟢 MobileEnhancements.init() completed');
        }

        // Swipe gestures for sidebar (DISABLED - Mobile has its own navigation pages)
        addTouchGestures() {
            // Disabled to prevent conflicts with mobile-native navigation flow.
        }

        // Pull to refresh hint
        addPullToRefreshHint() {
            let startY = 0;
            let isPulling = false;
            let pullIndicator = null;

            const createPullIndicator = () => {
                if (pullIndicator) return pullIndicator;
                
                pullIndicator = document.createElement('div');
                pullIndicator.className = 'pull-refresh-indicator';
                pullIndicator.innerHTML = '<i class="fas fa-arrow-down"></i> Yenilemek için çek';
                pullIndicator.style.cssText = `
                    position: fixed;
                    top: -60px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--primary);
                    color: white;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0 0 12px 12px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    z-index: 1001;
                    transition: top 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                `;
                document.body.appendChild(pullIndicator);
                return pullIndicator;
            };

            document.addEventListener('touchstart', (e) => {
                if (window.scrollY === 0) {
                    startY = e.touches[0].clientY;
                    isPulling = true;
                }
            }, { passive: true });

            document.addEventListener('touchmove', (e) => {
                if (!isPulling || window.scrollY > 0) return;

                const currentY = e.touches[0].clientY;
                const diff = currentY - startY;

                if (diff > 80) {
                    const indicator = createPullIndicator();
                    indicator.style.top = '0';
                }
            }, { passive: true });

            document.addEventListener('touchend', () => {
                if (pullIndicator) {
                    pullIndicator.style.top = '-60px';
                    setTimeout(() => {
                        if (pullIndicator && pullIndicator.style.top === '-60px') {
                            // Optionally trigger a refresh here
                            console.log('🔄 Pull to refresh triggered');
                        }
                    }, 300);
                }
                isPulling = false;
            }, { passive: true });
        }

        // Bottom navigation bar for mobile - REDUNDANT: Now using bottom-nav.html component
        addBottomNavigation() {
            // This function is now empty to prevent duplicate navigation bars.
            // The bottom navigation is handled by components/bottom-nav.html loaded in layout.js.
        }

        // Enhance scrolling with momentum
        enhanceScrolling() {
            console.log('🔧 enhanceScrolling() called. window.innerWidth:', window.innerWidth);
            document.documentElement.style.webkitOverflowScrolling = 'touch';
            document.documentElement.style.overflowScrolling = 'touch';
            
            // Hide header on scroll down, show on scroll up (mobile and tablet) - DISABLED for native app parity
            if (window.innerWidth <= 768) {
                // this.setupHeaderHideOnScroll(); // DİSABLED: Header should stay fixed
            } else {
                console.log('🔵 Desktop detected. Header hide not needed');
            }
        }

        // Setup header hide/show on scroll
        setupHeaderHideOnScroll() {
            console.log('🔧 setupHeaderHideOnScroll() called');
            
            // Wait for header to be loaded (it's loaded via JavaScript)
            const waitForHeader = () => {
                const header = document.querySelector('.site-header');
                console.log('🔍 Looking for .site-header...');
                
                if (!header) {
                    console.warn('⚠️ Header not found yet, retrying in 100ms...');
                    setTimeout(waitForHeader, 100);
                    return;
                }
                
                console.log('✅ Header found:', header);

                let lastScrollTop = 0;
                let isHidden = false;

                const scrollHandler = () => {
                    const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
                    
                    // Scroll down 80px - hide header
                    if (currentScroll > lastScrollTop && currentScroll > 80 && !isHidden) {
                        header.classList.add('hide');
                        isHidden = true;
                        console.log('⬆️ Header HIDING - scroll down:', currentScroll);
                    }
                    // Scroll up 50px - show header
                    else if (currentScroll < lastScrollTop - 50 && isHidden) {
                        header.classList.remove('hide');
                        isHidden = false;
                        console.log('⬇️ Header SHOWING - scroll up:', currentScroll);
                    }

                    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
                };

                window.addEventListener('scroll', scrollHandler, { passive: true });
                console.log('✅ Scroll listener attached to window');
            };
            
            // Start waiting for header
            waitForHeader();
        }

        // Add visual tap feedback to all interactive elements
        addTapFeedback() {
            const style = document.createElement('style');
            style.textContent = `
                button, 
                a, 
                .listing-card,
                .category-card,
                [role="button"] {
                    -webkit-tap-highlight-color: transparent;
                    touch-action: manipulation;
                }
                
                /* Ripple effect on tap */
                @keyframes ripple {
                    0% {
                        transform: scale(0);
                        opacity: 0.5;
                    }
                    100% {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
                
                .tap-ripple {
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(16, 185, 129, 0.3);
                    width: 20px;
                    height: 20px;
                    animation: ripple 0.6s ease-out;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);

            // Add ripple effect on tap
            document.addEventListener('touchstart', (e) => {
                const target = e.target.closest('button, a, .listing-card, .category-card');
                if (!target) return;

                const ripple = document.createElement('span');
                ripple.className = 'tap-ripple';
                
                const rect = target.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const y = e.touches[0].clientY - rect.top;
                
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                
                target.style.position = 'relative';
                target.appendChild(ripple);
                
                setTimeout(() => ripple.remove(), 600);
            }, { passive: true });
        }

        // Detect device orientation
        detectOrientation() {
            const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
            document.body.setAttribute('data-orientation', orientation);
            
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
                    document.body.setAttribute('data-orientation', newOrientation);
                }, 200);
            });
        }
        // Load dynamic configuration for the post ad button from Supabase
        async loadMobilePostAdButtonConfig() {
            const maxRetries = 10;
            let retries = 0;

            const tryLoad = async () => {
                try {
                    // Use window.supabase which is set in js/supabase.js
                    const supabase = window.supabase;
                    
                    if (!supabase) {
                        if (retries < maxRetries) {
                            retries++;
                            console.log(`ℹ️ Supabase not found, retrying... (${retries}/${maxRetries})`);
                            setTimeout(tryLoad, 500);
                            return;
                        }
                        console.log('ℹ️ Supabase client not found after retries, skipping dynamic button config.');
                        return;
                    }

                    const { data, error } = await supabase
                        .from('site_settings')
                        .select('setting_value, is_active')
                        .eq('setting_key', 'post_ad_button_config')
                        .single();

                    if (error || !data || !data.is_active) {
                        console.log('ℹ️ No active button config found for mobile.');
                        return;
                    }

                    const config = typeof data.setting_value === 'string'
                        ? JSON.parse(data.setting_value)
                        : data.setting_value;

                    const btn = document.querySelector('.post-ad-nav');
                    if (btn && config.image_url) {
                        btn.style.backgroundImage = `url('${config.image_url}')`;
                        btn.classList.add('dynamic-bg'); // Important for other CSS hooks if any

                        if (config.background_position_x !== undefined && config.background_position_y !== undefined) {
                            btn.style.backgroundPosition = `${config.background_position_x}% ${config.background_position_y}%`;
                        }

                        if (config.overlay_color) {
                            btn.style.setProperty('--btn-overlay', config.overlay_color);
                        }
                        
                        if (config.border_color) {
                            btn.style.border = `2px solid ${config.border_color}`;
                            btn.style.boxShadow = `0 4px 15px rgba(0, 0, 0, 0.3)`;
                        }
                    }
                } catch (err) {
                    console.error('Mobile post ad button config error:', err);
                }
            };

            tryLoad();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new MobileEnhancements();
        });
    } else {
        new MobileEnhancements();
    }
})();

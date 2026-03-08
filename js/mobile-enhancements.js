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
            this.initialized = true;
            console.log('🟢 MobileEnhancements.init() completed');
        }

        // Swipe gestures for sidebar
        addTouchGestures() {
            const mainContent = document.querySelector('.main-content');
            if (!mainContent) return;

            let startX = 0;
            let isDragging = false;

            mainContent.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                isDragging = true;
            }, { passive: true });

            mainContent.addEventListener('touchmove', (e) => {
                if (!isDragging) return;

                const currentX = e.touches[0].clientX;
                const diff = currentX - startX;

                // Swipe right from left edge to open sidebar
                if (startX < 50 && diff > 100) {
                    const sidebar = document.querySelector('.sidebar-categories');
                    if (sidebar) {
                        sidebar.classList.add('open');
                        document.body.classList.add('sidebar-open');
                    }
                    isDragging = false;
                }
            }, { passive: true });

            mainContent.addEventListener('touchend', () => {
                isDragging = false;
            }, { passive: true });
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

        // Bottom navigation bar for mobile
        addBottomNavigation() {
            if (window.innerWidth > 480) return;

            const existingNav = document.querySelector('.mobile-bottom-nav');
            if (existingNav) return;

            const bottomNav = document.createElement('nav');
            bottomNav.className = 'mobile-bottom-nav';
            bottomNav.innerHTML = `
                <a href="kategoriler.html" class="nav-item" id="mobile-categories-btn">
                    <i class="fas fa-th-large"></i>
                    <span>Kategoriler</span>
                </a>
                <a href="index.html" class="nav-item">
                    <i class="fas fa-home"></i>
                    <span>Anasayfa</span>
                </a>
                <a href="ilan-ver.html" class="nav-item nav-item-center post-ad-nav">
                    <i class="fas fa-plus"></i>
                    <span>İlan Ver</span>
                </a>
                <a href="mesajlar.html" class="nav-item">
                    <i class="fas fa-envelope"></i>
                    <span>Mesajlar</span>
                </a>
                <a href="profil.html" class="nav-item">
                    <i class="fas fa-user"></i>
                    <span>Profil</span>
                </a>
            `;

            bottomNav.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--surface, white);
                border-top: 1px solid var(--gray-200);
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                align-items: center;
                justify-items: center;
                z-index: 1000;
                box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
                height: 75px;
                padding: 0;
            `;

            document.body.appendChild(bottomNav);
            
            // Load dynamic styles for the post ad button
            this.loadMobilePostAdButtonConfig();
            
            // Add padding to main content to prevent overlap
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.paddingBottom = '90px';
            }

            // No event listener needed as it's now a direct link

            // Add CSS for nav items
            const style = document.createElement('style');
            style.textContent = `
                .mobile-bottom-nav {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem 0.75rem;
                    flex-wrap: nowrap;
                }
                
                .mobile-bottom-nav .nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 2px;
                    color: var(--gray-600, #666);
                    text-decoration: none;
                    font-size: 0.65rem;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    height: 100%;
                    width: 100%;
                    -webkit-tap-highlight-color: transparent;
                    white-space: nowrap;
                    overflow: hidden;
                }
                
                .mobile-bottom-nav .nav-item span {
                    display: block;
                    width: 100%;
                    text-align: center;
                    text-overflow: ellipsis;
                    overflow: hidden;
                    padding: 0 2px;
                }
                
                .mobile-bottom-nav .nav-item i {
                    font-size: 1.35rem;
                    color: var(--gray-600);
                    transition: color 0.2s ease;
                }
                
                /* Centered post ad button container */
                .mobile-bottom-nav .nav-item-center {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                }
                
                .mobile-bottom-nav .post-ad-nav {
                    background: var(--primary);
                    color: white;
                    border-radius: 50%;
                    width: 56px;
                    height: 56px;
                    padding: 0;
                    flex: 0 0 auto;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0;
                    position: relative;
                    overflow: hidden;
                    background-size: cover;
                    background-position: center;
                    z-index: 10;
                }
                
                .mobile-bottom-nav .post-ad-nav::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: var(--btn-overlay, transparent);
                    z-index: 1;
                    transition: all 0.3s ease;
                }
                
                .mobile-bottom-nav .post-ad-nav i {
                    font-size: 1.5rem;
                    color: white;
                    position: relative;
                    z-index: 2;
                }
                
                .mobile-bottom-nav .post-ad-nav span {
                    display: none;
                }
                
                .mobile-bottom-nav .post-ad-nav:hover,
                .mobile-bottom-nav .post-ad-nav:active {
                    background: var(--primary-dark);
                    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
                }
                
                .mobile-bottom-nav .post-ad-nav:active {
                    transform: scale(0.95);
                }
                
                .mobile-bottom-nav .nav-item:not(.post-ad-nav):active {
                    transform: scale(0.9);
                }
                
                .mobile-bottom-nav .nav-item:not(.post-ad-nav):hover i {
                    color: var(--primary);
                }
                
                .mobile-bottom-nav .nav-item:not(.post-ad-nav):active i {
                    color: var(--primary);
                }
            `;
            document.head.appendChild(style);
        }

        // Enhance scrolling with momentum
        enhanceScrolling() {
            console.log('🔧 enhanceScrolling() called. window.innerWidth:', window.innerWidth);
            document.documentElement.style.webkitOverflowScrolling = 'touch';
            document.documentElement.style.overflowScrolling = 'touch';
            
            // Hide header on scroll down, show on scroll up (mobile and tablet)
            if (window.innerWidth <= 768) {
                console.log('🟢 Mobile/Tablet detected. Setting up header hide on scroll');
                this.setupHeaderHideOnScroll();
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

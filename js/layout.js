// js/layout.js - GÜNCELLENMİŞ VERSİYON
function loadHeaderIfNeeded() {
    try {
        const headerPlaceholder = document.getElementById("header-placeholder");
        if (!headerPlaceholder) {
            console.warn('⚠️ header-placeholder bulunamadı; header yüklenemiyor.');
            return;
        }

        if (headerPlaceholder.dataset.loaded === "true") return;

        fetch("/components/header.html")
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Header fetch failed: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                if (!data || data.trim().length === 0) {
                    throw new Error('Header içerği boş döndü.');
                }
                headerPlaceholder.innerHTML = data;
                headerPlaceholder.dataset.loaded = "true";

                // Header yüklendiğinde olay yayınla ve rozetleri senkronize et
                console.log('✅ Header yüklendi, headerLoaded olayı yayınlanıyor.');
                document.dispatchEvent(new Event('headerLoaded'));
                import('./header-badges.js')
                    .then(module => {
                        if (typeof module.syncHeaderBadges === 'function') {
                            module.syncHeaderBadges();
                        }
                    })
                    .catch(err => console.error('Header rozetlerini güncellerken hata:', err));

                // Modalları body'ye taşı (z-index sorunu için)
                const modal = document.getElementById('quickPostModal');
                if (modal) {
                    document.body.appendChild(modal);
                }

                // Diğer başlatıcıları çağır (Eğer fonksiyonlar tanımlıysa)
                if (typeof initializeFilters === "function") initializeFilters();
                if (typeof initializeHeaderActions === "function") initializeHeaderActions();
                if (typeof initializeModalSystem === "function") initializeModalSystem();
                if (typeof initializeLogout === "function") initializeLogout();
                if (typeof initializeCategoriesToggle === "function") initializeCategoriesToggle();

                // Buton yapılandırmasını yükle
                loadPostAdButtonConfig();
            })
            .catch(error => {
                console.error("Header yükleme hatası:", error);
                // Basit bir fallback header ekle — böylece kullanıcı sayfada navigasyon kaybetmez
                try {
                    const fallback = `
                        <header class="site-header" role="banner">
                            <div class="header-main">
                                <a href="/" class="site-logo">
                                    <div class="logo-icon">V</div>
                                    <h1 class="logo-text">VERDE</h1>
                                </a>
                                <div class="header-right">
                                     <a href="/ilan-ver.html" class="btn-post-ad"><i class="fas fa-plus"></i><span>Sell Now</span></a>
                                </div>
                            </div>
                        </header>
                    `;
                    headerPlaceholder.innerHTML = fallback;
                    headerPlaceholder.dataset.loaded = "true";
                    console.warn('⚠️ Fallback header eklendi. Orijinal header yüklenemedi.');
                    document.dispatchEvent(new Event('headerLoaded'));
                } catch (e) {
                    console.error('Fallback header eklenemedi:', e);
                }
            });
    } catch (err) {
        console.error('Header yükleme sırasında beklenmeyen hata:', err);
    }
}

/**
 * Loads the configuration for the "+ Post Ad" button from Supabase
 * and applies the background image and overlay styles.
 */
async function loadPostAdButtonConfig() {
    try {
        const { supabase } = await import('./supabase.js');
        if (!supabase) return;

        const { data, error } = await supabase
            .from('site_settings')
            .select('*')
            .eq('setting_key', 'post_ad_button_config')
            .single();

        let config;
        let isActive = true;

        if (error || !data) {
            // Apply a default "Test" configuration if no database entry exists
            console.log('ℹ️ No button config found in Supabase, applying default test style.');
            config = {
                image_url: '/assets/images/malta_balconies.png',
                overlay_color: 'rgba(16, 185, 129, 0.6)',
                border_color: '#003366',
                is_active: true
            };
            window.location.href = '/';
        } else {
            isActive = data.is_active;
            config = typeof data.setting_value === 'string'
                ? JSON.parse(data.setting_value)
                : data.setting_value;
        }

        if (!isActive) return;

        const btn = document.querySelector('.btn-post-ad');
        if (btn && config.image_url) {
            btn.classList.add('dynamic-bg');
            btn.style.backgroundImage = `url('${config.image_url}')`;

            // Apply alignment
            if (config.background_position_x !== undefined && config.background_position_y !== undefined) {
                btn.style.backgroundPosition = `${config.background_position_x}% ${config.background_position_y}%`;
            }

            if (config.overlay_color) {
                btn.style.setProperty('--btn-overlay', config.overlay_color);

                // Estimate a hover color
                const hoverColor = config.overlay_color.includes('rgba')
                    ? config.overlay_color.replace(/[\d.]+\)$/, '0.4)')
                    : config.overlay_color;
                btn.style.setProperty('--btn-overlay-hover', hoverColor);
                if (config.border_color) {
                    btn.style.setProperty('--btn-border', config.border_color);
                }
            }
        }
    } catch (err) {
        console.error('Buton yapılandırması yüklenirken hata:', err);
    }
}

function loadBottomNavIfNeeded() {
    try {
        const placeholder = document.getElementById("bottom-nav-placeholder");
        if (!placeholder) return;
        if (placeholder.dataset.loaded === "true") return;

        fetch("/components/bottom-nav.html")
            .then(response => response.ok ? response.text() : null)
            .then(data => {
                if (data) {
                    placeholder.innerHTML = data;
                    placeholder.dataset.loaded = "true";
                    document.dispatchEvent(new Event('bottomNavLoaded'));
                }
            })
            .catch(err => console.error("Bottom nav load error:", err));
    } catch (err) {
        console.error("Bottom nav unexpected error:", err);
    }
}

/**
 * Sidebar avatar upload functionality.
 * Allows users to change their profile picture by clicking on the sidebar avatar.
 */
async function initializeSidebarAvatarUpload() {
    const wrapper = document.getElementById('sidebarAvatarWrapper');
    const input = document.getElementById('sidebarAvatarInput');
    const editBtn = document.querySelector('.edit-avatar-btn');
    const avatarImg = document.getElementById('sidebarProfileImage');

    if (!wrapper || !input) return;

    // Click on camera icon or wrapper triggers file input
    const triggerInput = () => input.click();
    if (editBtn) editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerInput();
    });
    wrapper.addEventListener('click', triggerInput);

    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Add loading state
            wrapper.classList.add('uploading');

            // Dynamic import to avoid circular dependencies or unnecessary loading
            const { uploadAvatar } = await import('./profile-manager.js');
            const publicUrl = await uploadAvatar(file);

            // Update UI
            if (avatarImg) avatarImg.src = publicUrl;
            
            // Update header avatars if they exist
            const headerAvatars = document.querySelectorAll('.user-avatar img');
            headerAvatars.forEach(img => img.src = publicUrl);

            console.log('✅ Avatar updated successfully:', publicUrl);
        } catch (error) {
            console.error('❌ Avatar upload failed:', error);
            alert('Upload failed: ' + error.message);
        } finally {
            wrapper.classList.remove('uploading');
            input.value = ''; // Reset input
        }
    });
}

// Global Modal & Notification System Injection
const injectGlobalSystems = () => {
    // 1. Inject modals.css
    if (!document.getElementById('vendo-modals-css')) {
        const link = document.createElement('link');
        link.id = 'vendo-modals-css';
        link.rel = 'stylesheet';
        link.href = '/css/modals.css';
        document.head.appendChild(link);
    }

    // 2. Inject modal-system.js
    import('/js/modal-system.js')
        .then(module => {
            window.VendoAlert = module.VendoAlert;
            window.VendoConfirm = module.VendoConfirm;
            window.VendoPrompt = module.VendoPrompt;
            console.log('💎 VENDO Modal System Initialized');
        })
        .catch(err => console.error('❌ Modal system injection failed:', err));
        
    // 3. Inject toast system (if not already handled)
    import('/js/toast.js')
        .then(module => {
            window.showToast = module.showToast;
            console.log('🍞 VENDO Toast System Initialized');
        })
        .catch(err => console.error('❌ Toast system injection failed:', err));
};

// Eğer DOMContentLoaded zaten geçtiyse hemen çalıştır, değilse listener ekle
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadHeaderIfNeeded();
        loadBottomNavIfNeeded();
        initializeSidebarAvatarUpload();
        injectGlobalSystems();
    });
} else {
    // DOM hazırsa hemen yükle
    loadHeaderIfNeeded();
    loadBottomNavIfNeeded();
    initializeSidebarAvatarUpload();
    injectGlobalSystems();
}
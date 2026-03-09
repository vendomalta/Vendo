/* =========================================
   🎨 UI.JS - Arayüz ve Dinamik Form Sistemi (TAMİR EDİLDİ)
   ========================================= */

// --- DARK MODE VE TEMA BAŞLANGICI ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Initializing Vendo UI Systems...");

    // 1. Kayıtlı temayı yükle
    const savedTheme = localStorage.getItem('verde_theme') || 'light';
    applyTheme(savedTheme);


    // 2. Tema Butonlarını Dinle (YENİ EKLENEN KISIM)
    initializeThemeToggles();

    // 3. İlan Görünüm Kontrollerini Dinle (YENİ EKLENEN)
    initializeViewControls();

    // 4. Sayfalama Butonlarını Dinle
    initializePagination();
    // 5. Sayısal giriş formatlama
    initializeNumericFormatting();

    // 6. Header yüklendikten sonra header aksiyonlarını başlat
    document.addEventListener('headerLoaded', () => {
        console.log('✅ Header loaded, initializing header actions...');
        initializeHeaderActions();
    });

    // 7. Eğer header zaten yüklüyse direkt başlat
    setTimeout(() => {
        if (document.querySelector('.user-button')) {
            console.log('✅ Header already exists, initializing header actions...');
            initializeHeaderActions();
        }
    }, 100);
});// --- TEMA UYGULAMA (GÜNCELLENDİ) ---
function applyTheme(themeName) {
    let effectiveTheme = themeName;

    if (themeName === 'auto') {
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveTheme = isSystemDark ? 'dark' : 'light';
    }

    if (effectiveTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }

    // LocalStorage güncelle
    localStorage.setItem('verde_theme', themeName);

    // Butonların görsel durumunu güncelle
    updateThemeUI(themeName);
}

// --- TEMA BUTONLARINI DİNLEME (YENİ) ---
function initializeThemeToggles() {
    // Ayarlar sayfasındaki kutucukları bul
    const themeOptions = document.querySelectorAll('.theme-option');
    if (themeOptions.length > 0) {
        themeOptions.forEach(option => {
            option.addEventListener('click', function () {
                const selectedTheme = this.getAttribute('data-theme');
                applyTheme(selectedTheme);
            });
        });
    }

    // Görünüm sayfasındaki radio butonları (varsa)
    const radioInputs = document.querySelectorAll('input[name="theme"]');
    radioInputs.forEach(radio => {
        radio.addEventListener('change', function () {
            applyTheme(this.value);
        });
    });
}

// --- TEMA BUTONLARINI AKTİF YAPMA (YENİ) ---
function updateThemeUI(activeTheme) {
    // Ayarlar sayfasındaki kutucukları boya
    document.querySelectorAll('.theme-option').forEach(opt => {
        if (opt.getAttribute('data-theme') === activeTheme) {
            opt.classList.add('active'); // CSS'de .active stili eklemen gerekebilir
            opt.style.borderColor = "var(--primary)"; // Manuel stil
        } else {
            opt.classList.remove('active');
            opt.style.borderColor = "";
        }
    });

    // Radio butonları güncelle
    const radio = document.querySelector(`input[name="theme"][value="${activeTheme}"]`);
    if (radio) radio.checked = true;
}

// --- KULLANICI GİRİŞ DURUMUNU KONTROL ET ---
function checkUserLoginStatus() {
    // ✅ SECURITY: Use Supabase session, do not store user info in localStorage
    // Email ve şifre bilgileri güvenliğe risk oluşturabilir

    // Auth durumunu auth.js'den kontrol et
    // (auth.js updateAuthUI() fonksiyonu bunu zaten yapıyor)

    const userMenu = document.querySelector('.user-menu');
    const authButtons = document.querySelector('.auth-buttons');

    // İlk kontrolü yap - henüz Supabase'den session yüklenmişse gözük
    if (userMenu && userMenu.style.display !== 'none') {
        // Zaten giriş yapmış (auth.js tarafından set edildi)
        return;
    }

    // Default: çıkış yapmış durumu göster
    if (userMenu) userMenu.style.display = 'none';
    if (authButtons) authButtons.style.display = 'flex';
}

// --- ÇIKIŞ YAPMA FONKSİYONU ---
function initializeLogout() {
    const logoutBtn = document.querySelector('.dropdown-item.logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();

            // ✅ GÜVENLIK: Supabase oturumundan çıkış yap
            if (typeof handleLogout === 'function') {
                handleLogout();
            } else {
                // Fallback: localStorage'dan GÜVENSİZ veriyi temizle (email, password vs)
                localStorage.removeItem('userLoggedIn');
                localStorage.removeItem('userName');
                localStorage.removeItem('userEmail');
                // ✅ Sadece güvenli veri kalsın: theme
                window.location.href = 'login.html';
            }
        });
    }
}

// --- BİLDİRİMLER, FİLTRELER VE PROFİL MENÜSÜ (HEADER ETKİLEŞİMLERİ) ---
function initializeHeaderActions() {
    console.log('🔧 initializeHeaderActions starting...');

    // Selectors match the new simple & modern header structure
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const userMenuBtn = document.querySelector('.user-button');
    const userDropdown = document.querySelector('.user-dropdown');
    const markAllReadBtn = document.querySelector('.mark-all-read');

    // Generic toggle function for modern minimalist behavior
    const toggleDropdown = (trigger, dropdown) => {
        if (!trigger || !dropdown || trigger.dataset.listenerAttached) return;
        
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isActive = dropdown.classList.contains('active');

            // Close all other dropdowns
            document.querySelectorAll('.notification-dropdown, .user-dropdown').forEach(d => {
                d.classList.remove('active');
            });

            if (!isActive) {
                dropdown.classList.add('active');
            }
        });
        
        trigger.dataset.listenerAttached = 'true';
    };

    toggleDropdown(notificationBtn, notificationDropdown);
    toggleDropdown(userMenuBtn, userDropdown);

    if (markAllReadBtn && !markAllReadBtn.dataset.listenerAttached) {
        markAllReadBtn.addEventListener('click', () => {
            document.querySelectorAll('.notification-item.unread').forEach(item => {
                item.classList.remove('unread');
            });
            const badge = notificationBtn?.querySelector('.notification-badge');
            if (badge) badge.style.display = 'none';
        });
        markAllReadBtn.dataset.listenerAttached = 'true';
    }

    // Close on outside click - limited to one observer
    if (!document.dataset?.globalHeaderClickAttached) {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.header-icon') && !e.target.closest('.user-button') &&
                !e.target.closest('.notification-dropdown') && !e.target.closest('.user-dropdown')) {
                document.querySelectorAll('.notification-dropdown, .user-dropdown').forEach(d => {
                    d.classList.remove('active');
                });
            }
        });
        if (document.documentElement) {
            document.documentElement.dataset.globalHeaderClickAttached = 'true';
        }
    }
}

// --- AYARLAR SAYFASI GEÇİŞLERİ (EKSİK OLAN KISIM EKLENDİ) ---
function initializeSettingsNavigation() {
    const navItems = document.querySelectorAll('.settings-nav .nav-item');
    const sections = document.querySelectorAll('.settings-section');

    if (navItems.length === 0) return;

    navItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            this.classList.add('active');

            // href="#account" gibi değerlerden ID'yi al
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                const targetId = href.substring(1);
                const targetSection = document.getElementById(targetId);
                if (targetSection) targetSection.classList.add('active');
            }
        });
    });
}

// --- İLANLARI BAŞLAT (YENİ EKLENEN) ---
function initializeListings() {
    // İlan favorileme butonlarını dinle
    const favoriteButtons = document.querySelectorAll('.favorite-button');

    favoriteButtons.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const icon = this.querySelector('i');
            if (icon.classList.contains('far')) {
                icon.classList.remove('far');
                icon.classList.add('fas');
                showNotification('Favorilere eklendi', 'success');
            } else {
                icon.classList.remove('fas');
                icon.classList.add('far');
                showNotification('Removed from favorites', 'info');
            }
        });
    });

    console.log('📋 Listing system initialized');
}

// --- SAYFALAMA BUTONLARINI DİNLE (YENİ EKLENEN) ---
function initializePagination() {
    const paginationButtons = document.querySelectorAll('.page-number[data-page], .next[data-page], .prev[data-page]');

    paginationButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const pageNum = this.getAttribute('data-page');
            if (pageNum) {
                window.location.href = `sayfa${pageNum}.html`;
            }
        });
    });
}

// --- GENEL BİLDİRİM (TOAST) (EKSİK OLAN KISIM EKLENDİ) ---
// --- GENEL BİLDİRİM (TOAST) ---
function showNotification(message, type = 'info', title = '') {
    // Toast container kontrolü
    let container = document.querySelector('.verde-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'verde-toast-container';
        document.body.appendChild(container);
    }

    // Başlık belirleme
    const defaultTitles = {
        success: 'Success',
        error: 'Error',
        info: 'Information',
        warning: 'Warning'
    };
    const toastTitle = title || defaultTitles[type] || 'Notice';

    // İkon belirleme
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    const iconClass = icons[type] || 'fa-info-circle';

    // Toast oluşturma
    const toast = document.createElement('div');
    toast.className = `verde-toast ${type}`;
    toast.innerHTML = `
        <div class="verde-toast-icon">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="verde-toast-content">
            <div class="verde-toast-title">${toastTitle}</div>
            <div class="verde-toast-message">${message}</div>
        </div>
        <button class="verde-toast-close">
            <i class="fas fa-times"></i>
        </button>
        <div class="verde-toast-progress">
            <div class="verde-toast-progress-bar"></div>
        </div>
    `;

    container.appendChild(toast);

    // Kapatma butonu
    const closeBtn = toast.querySelector('.verde-toast-close');
    closeBtn.onclick = () => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 400);
    };

    // Otomatik kapatma
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 400);
        }
    }, 5000);
}

// Global exposure for compatibility
window.showToast = showNotification;
window.showInlineToast = showNotification;
window.showNotification = showNotification;

// --- ÖZEL PROMPT DİYALOGU (Custom Prompt Dialog) ---
function showPromptDialog(message, defaultValue = '', confirmText = 'OK', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-dialog-icon" style="color: var(--primary);">
                    <i class="fas fa-edit"></i>
                </div>
                <div class="confirm-dialog-message">${message}</div>
                <div class="confirm-dialog-input-container" style="margin-bottom: 1.5rem;">
                    <textarea class="confirm-dialog-input" style="width: 100%; min-height: 100px; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 10px; font-family: inherit; font-size: 1rem; outline: none; transition: border-color 0.2s; resize: vertical;">${defaultValue}</textarea>
                </div>
                <div class="confirm-dialog-actions">
                    <button class="confirm-btn-cancel">${cancelText}</button>
                    <button class="confirm-btn-confirm" style="background: var(--primary);">${confirmText}</button>
                </div>
            </div>
        `;

        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 10002; animation: fadeIn 0.2s;
        `;

        const dialog = overlay.querySelector('.confirm-dialog');
        dialog.style.cssText = `
            background: white; border-radius: 16px; padding: 2rem;
            max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        const input = dialog.querySelector('.confirm-dialog-input');
        input.addEventListener('focus', () => input.style.borderColor = 'var(--primary)');
        input.addEventListener('blur', () => input.style.borderColor = '#e2e8f0');

        const cancelBtn = dialog.querySelector('.confirm-btn-cancel');
        const confirmBtn = dialog.querySelector('.confirm-btn-confirm');

        cancelBtn.style.cssText = `
            padding: 0.75rem 1.5rem; border-radius: 10px; border: 2px solid #e2e8f0;
            background: white; color: #64748b; font-weight: 600; cursor: pointer;
            transition: all 0.2s; font-size: 1rem;
        `;

        confirmBtn.style.cssText = `
            padding: 0.75rem 1.5rem; border-radius: 10px; border: none;
            background: var(--primary, #3b82f6); color: white; font-weight: 600; cursor: pointer;
            transition: all 0.2s; font-size: 1rem;
        `;

        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(null);
        });

        confirmBtn.addEventListener('click', () => {
            const val = input.value;
            overlay.remove();
            resolve(val);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(null);
            }
        });

        document.body.appendChild(overlay);
        input.focus();
        // Cursoru sona al
        input.setSelectionRange(input.value.length, input.value.length);
    });
}

// --- ÖZEL ONAY DİYALOGU (Custom Confirm Dialog) ---
function showConfirmDialog(message, confirmText = 'Yes', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-dialog-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="confirm-dialog-message">${message}</div>
                <div class="confirm-dialog-actions">
                    <button class="confirm-btn-cancel">${cancelText}</button>
                    <button class="confirm-btn-confirm">${confirmText}</button>
                </div>
            </div>
        `;

        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 10001; animation: fadeIn 0.2s;
        `;

        const dialog = overlay.querySelector('.confirm-dialog');
        dialog.style.cssText = `
            background: white; border-radius: 16px; padding: 2rem;
            max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        const icon = dialog.querySelector('.confirm-dialog-icon');
        icon.style.cssText = `
            text-align: center; margin-bottom: 1rem;
            font-size: 3rem; color: #f59e0b;
        `;

        const messageEl = dialog.querySelector('.confirm-dialog-message');
        messageEl.style.cssText = `
            text-align: center; font-size: 1.1rem; color: #1e293b;
            margin-bottom: 1.5rem; line-height: 1.6;
        `;

        const actions = dialog.querySelector('.confirm-dialog-actions');
        actions.style.cssText = `
            display: flex; gap: 0.75rem; justify-content: center;
        `;

        const cancelBtn = dialog.querySelector('.confirm-btn-cancel');
        cancelBtn.style.cssText = `
            padding: 0.75rem 1.5rem; border-radius: 10px; border: 2px solid #e2e8f0;
            background: white; color: #64748b; font-weight: 600; cursor: pointer;
            transition: all 0.2s; font-size: 1rem;
        `;

        const confirmBtn = dialog.querySelector('.confirm-btn-confirm');
        confirmBtn.style.cssText = `
            padding: 0.75rem 1.5rem; border-radius: 10px; border: none;
            background: #ef4444; color: white; font-weight: 600; cursor: pointer;
            transition: all 0.2s; font-size: 1rem;
        `;

        cancelBtn.addEventListener('mouseenter', () => {
            cancelBtn.style.borderColor = '#94a3b8';
            cancelBtn.style.background = '#f8fafc';
        });
        cancelBtn.addEventListener('mouseleave', () => {
            cancelBtn.style.borderColor = '#e2e8f0';
            cancelBtn.style.background = 'white';
        });

        confirmBtn.addEventListener('mouseenter', () => {
            confirmBtn.style.background = '#dc2626';
            confirmBtn.style.transform = 'translateY(-1px)';
        });
        confirmBtn.addEventListener('mouseleave', () => {
            confirmBtn.style.background = '#ef4444';
            confirmBtn.style.transform = 'translateY(0)';
        });

        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(false);
        });

        confirmBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(true);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });

        document.body.appendChild(overlay);
    });
}

// --- KATEGORİLER TOGGLE KONTROLÜ ---
function initializeCategoriesToggle() {
    const toggleBtn = document.querySelector('.categories-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Sidebar varsa aç/kapat (toggle)
            const sidebar = document.querySelector('.sidebar-categories');
            if (sidebar) {
                const isOpen = sidebar.classList.contains('open');
                if (isOpen) {
                    // Close sidebar
                    sidebar.classList.remove('open');
                    document.body.classList.remove('sidebar-open');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                } else {
                    // Open sidebar
                    sidebar.classList.add('open');
                    document.body.classList.add('sidebar-open');
                    toggleBtn.setAttribute('aria-expanded', 'true');
                }
            }
        });

        // Sidebar kapatıldığında toggle buttonunu güncelle
        document.addEventListener('sidebar-closed', () => {
            toggleBtn.setAttribute('aria-expanded', 'false');
        });
    }
}

// --- AKTİF SAYFA İKONUNU YAK (EKSİK OLAN KISIM EKLENDİ) ---
function highlightActivePage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const headerLinks = document.querySelectorAll('.header-icon');

    headerLinks.forEach(link => {
        const linkTarget = link.getAttribute('href');
        if (linkTarget === currentPage) {
            link.classList.add('active');
        }
    });
}
// --- İLAN VİTRİNİ GÖRÜNÜM KONTROLÜ ---
function initializeViewControls() {
    const viewButtons = document.querySelectorAll('.view-button, .view-toggle');
    const listingsGrid = document.querySelector('.listings-grid');
    const tableHeader = document.querySelector('.listings-table-header');

    if (viewButtons.length === 0 || !listingsGrid) return;

    const allowedViews = ['grid', 'table'];
    const classMap = { grid: 'grid-view', table: 'table-view' };

    const applyView = (view) => {
        const targetView = allowedViews.includes(view) ? view : 'grid';
        listingsGrid.classList.remove('grid-view', 'table-view', 'list-view-horizontal');
        listingsGrid.classList.add(classMap[targetView]);
        if (tableHeader) {
            tableHeader.classList.toggle('is-active', targetView === 'table');
        }

        // View-controls parent sınıfını güncelle (CSS indicator için)
        const viewControls = document.querySelector('.view-controls');
        if (viewControls) {
            viewControls.classList.remove('grid-v-active', 'table-v-active');
            viewControls.classList.add(`${targetView}-v-active`);
        }

        localStorage.setItem('verde_view', targetView);
    };

    // Kayıtlı görünümü yükle ve uygula
    const savedView = localStorage.getItem('verde_view') || 'grid';
    const initialView = allowedViews.includes(savedView) ? savedView : 'grid';
    applyView(initialView);

    // Buton aktifliklerini güncelle
    document.querySelectorAll('.view-button, .view-toggle').forEach(btn => {
        const btnView = btn.getAttribute('data-view') || 'grid';
        btn.classList.toggle('active', btnView === initialView);
    });

    // Tıklama dinleyicileri
    viewButtons.forEach(button => {
        const viewMode = button.getAttribute('data-view') || 'grid';
        button.addEventListener('click', function () {
            document.querySelectorAll('.view-button, .view-toggle').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            applyView(viewMode);
            console.log(`🖼️ Listing view changed: ${viewMode}`);
        });
    });
}

// --- SAYILAR İÇİN HAFİF FORMATLAMA ---
function initializeNumericFormatting() {
    const fmt = new Intl.NumberFormat('tr-TR');
    const attach = (input) => {
        if (!input) return;
        input.addEventListener('input', () => {
            const digits = (input.value || '').toString().replace(/[^0-9]/g, '');
            if (!digits) { input.value = ''; return; }
            input.value = fmt.format(parseInt(digits, 10));
        });
    };
    attach(document.getElementById('adPrice'));
}

// Konteyner içindeki bazı sayısal alanlara yerel format ata
function attachNumericFormattingIn(container) {
    const fmt = new Intl.NumberFormat('tr-TR');
    const bind = (selector, options = {}) => {
        container.querySelectorAll(selector).forEach(input => {
            input.addEventListener('input', () => {
                const digits = (input.value || '').toString().replace(/[^0-9]/g, '');
                if (!digits) { input.value = ''; return; }
                if (options.noFormat) {
                    input.value = digits.slice(0, options.maxLength || digits.length);
                } else {
                    input.value = fmt.format(parseInt(digits, 10));
                }
            });
        });
    };
    bind('input[name="square_meters"]');
    bind('input[name="km"]');
    bind('input[name="year"]', { noFormat: true, maxLength: 4 });
}

// --- MODAL UTILITY ---
window.Modal = {
    currentModal: null,

    open(title, content, buttons = []) {
        // Modal HTML oluştur
        const modalHtml = `
            <div class="modal-overlay" id="verde-modal">
                <div class="modal-container">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="modal-close" onclick="Modal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    ${buttons.length > 0 ? `
                        <div class="modal-footer">
                            ${buttons.map(btn => `
                                <button class="${btn.class || 'btn-primary'}" onclick="${btn.action}">
                                    ${btn.label}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Modal'ı ekle
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.currentModal = document.getElementById('verde-modal');

        // CSS ekle (eğer yoksa)
        if (!document.getElementById('modal-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'modal-styles';
            styleEl.textContent = `
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.2s ease;
                }
                
                .modal-container {
                    background: white;
                    border-radius: 12px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow: hidden;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                    animation: slideUp 0.3s ease;
                }
                
                .modal-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .modal-header h3 {
                    margin: 0;
                    color: #1e293b;
                    font-size: 1.25rem;
                }
                
                .modal-close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    color: #64748b;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                }
                
                .modal-close:hover {
                    background: #f1f5f9;
                    color: #1e293b;
                }
                
                .modal-body {
                    padding: 1.5rem;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                
                .modal-footer {
                    padding: 1rem 1.5rem;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `;
            document.head.appendChild(styleEl);
        }

        // ESC tuşu ile kapatma
        document.addEventListener('keydown', this.handleEscape);

        // Overlay'e tıklayınca kapat
        this.currentModal.addEventListener('click', (e) => {
            if (e.target === this.currentModal) {
                this.close();
            }
        });
    },

    close() {
        if (this.currentModal) {
            this.currentModal.remove();
            this.currentModal = null;
        }
        document.removeEventListener('keydown', this.handleEscape);
    },

    handleEscape(e) {
        if (e.key === 'Escape') {
            Modal.close();
        }
    }
};

// ===== FAVORILER BUTONU GİRİŞ KONTROLÜ =====
async function initializeFavoritesButtonAuth() {
    const favoritesBtn = document.querySelector('a.header-icon[href="favorilerim.html"]');

    if (!favoritesBtn) return;

    favoritesBtn.addEventListener('click', async (e) => {
        // Supabase'den auth'u import et
        const { supabase } = await import('./supabase.js');

        // Mevcut kullanıcıyı kontrol et
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Giriş yapılmadıysa, login sayfasına yönlendir
            e.preventDefault();
            const redirectUrl = encodeURIComponent(window.location.href);
            window.location.href = `login.html?redirect=${redirectUrl}`;
        }
        // Giriş yapılmışsa normal olarak favoriler sayfasına gider
    });
}

// DOMContentLoaded'da veya header yüklendikten sonra çağır
document.addEventListener('DOMContentLoaded', initializeFavoritesButtonAuth);
window.addEventListener('header-loaded', initializeFavoritesButtonAuth);
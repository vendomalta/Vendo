// Sidebar Kategoriler Yöneticisi - Hybrid: Accordion (Level 1) + Page-based (Level 2+)
import { categoryRouter } from './category-router.js';
import { getRootCategories, getChildCategories, getCategoryById, initializeCategories } from './category-data.js';

// HTML Güvenliği
function sanitizeHtml(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

class SidebarManager {
    constructor() {
        this.container = document.querySelector('.sidebar-categories-content');
        this.headerTitle = document.querySelector('.sidebar-header .sidebar-toggle-btn span');
        this.activeId = null;
        this.isCollapsed = false;
    }

    init() {
        if (!this.container) return;

        // Router event listener
        window.addEventListener('categoryNavigated', (e) => {
            const { path } = e.detail;
            if (path && path.length > 0) {
                this.activeId = path[path.length - 1].id;
            } else {
                this.activeId = null;
            }
            // Re-render based on new path
            this.render();
        });

        // Master Toggle Listener
        const masterToggleBtn = document.querySelector('.sidebar-header .sidebar-toggle-btn');
        if (masterToggleBtn) {
            masterToggleBtn.addEventListener('click', () => {
                this.isCollapsed = !this.isCollapsed;
                const icon = masterToggleBtn.querySelector('.expand-icon');
                
                if (this.isCollapsed) {
                    this.container.classList.add('collapsed');
                    icon.classList.add('rotated');
                } else {
                    this.container.classList.remove('collapsed');
                    icon.classList.remove('rotated');
                }
            });
        }

        this.render();
    }

    render() {
        const path = categoryRouter.getCurrentPath();
        const level = path.length;

        // Level 2 ve üzeri (örn: Vasıta > Otomobil) -> Drill Down (Sadece alt kategoriler)
        if (level >= 2) {
            const currentCategory = path[path.length - 1]; // Örn: Otomobil
            this.renderDrillDown(currentCategory);
        } else {
            // Level 0 (Home) veya Level 1 (Vasıta) -> Root View (Accordion)
            this.renderRoots(path);
        }
    }

    renderRoots(path) {
        // Reset Header
        if (this.headerTitle) this.headerTitle.textContent = 'Categories';

        const roots = getRootCategories();
        if (!roots || roots.length === 0) {
            this.container.innerHTML = '<div class="categories-empty"><i class="fas fa-exclamation-circle"></i><p>No categories found.</p></div>';
            return;
        }

        // Accordion wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'sidebar-accordion-main';

        roots.forEach(cat => {
            const item = this.createRootItem(cat);
            wrapper.appendChild(item);
        });

        this.container.innerHTML = '';
        this.container.appendChild(wrapper);

        // Eğer bir Level 1 kategori seçiliyse (örn: Vasıta), onu otomatik aç
        if (path && path.length >= 1) {
            const rootId = path[0].id;
            // String/Number conversion issue fix:
            const activeHeader = wrapper.querySelector(`.accordion-header[data-id="${rootId}"]`);
            if (activeHeader) {
                const container = activeHeader.parentElement;
                // Eğer zaten açık değilse aç
                if (!container.querySelector('.accordion-content')) {
                    this.toggleAccordion(container, activeHeader, rootId);
                }
                activeHeader.classList.add('active');
            }
        }
    }

    createRootItem(category) {
        const container = document.createElement('div');
        container.className = 'accordion-wrapper';

        const hasChildren = getChildCategories(category.id).length > 0;

        const header = document.createElement('div');
        header.className = 'accordion-header';
        header.dataset.id = category.id;

        const isLocked = category.is_locked === true;
        if (isLocked) header.classList.add('locked');

        const iconClass = category.icon || 'fa-folder';

        header.innerHTML = `
            <i class="fas ${iconClass}"></i>
            <span>${sanitizeHtml(category.name)}</span>
            ${isLocked ? '<i class="fas fa-lock" style="margin-left: auto; font-size: 0.8rem; opacity: 0.7;"></i>' : (hasChildren ? '<i class="fas fa-chevron-down expand-icon"></i>' : '')}
        `;

        header.addEventListener('click', (e) => {
            e.preventDefault();
            if (isLocked) return;

            // 1. Sadece İlanları ve URL'i Güncelle
            // Accordion'ı renderRoots path kontrolü ile açacak
            categoryRouter.navigateToCategory(category.id);
        });

        container.appendChild(header);
        return container;
    }

    toggleAccordion(container, header, categoryId) {
        const icon = header.querySelector('.expand-icon');
        const existingContent = container.querySelector('.accordion-content');

        if (existingContent) {
            // Kapat
            existingContent.remove();
            if (icon) icon.classList.remove('rotated');
            return;
        }

        // Aç
        if (icon) icon.classList.add('rotated');

        // Diğerlerini kapat (Opsiyonel - tek açık mantığı)
        this.collapseAllOthers(container);

        // ID tip güvenliği için (string/number) loose equality veya number conversion
        // getChildCategories genelde type-strict çalışır (category-data.js içinde).
        // Bu yüzden categoryId'yi doğru tipte (muhtemelen number) göndermeliyiz.
        // renderRoots'tan geliyorsa zaten number.
        // Ancak dataset'ten okursak string.

        // category-data.js: cat.parentId === parentId (Strict)
        // Bu yüzden categoryId number olmalı.
        const numericId = Number(categoryId);
        const children = getChildCategories(isNaN(numericId) ? categoryId : numericId);

        if (!children || children.length === 0) return;

        const content = document.createElement('div');
        content.className = 'accordion-content';

        children.forEach(child => {
            const subItem = document.createElement('div');
            const isLocked = child.is_locked === true;
            subItem.className = 'accordion-subitem' + (isLocked ? ' locked' : '');

            subItem.innerHTML = `
                <span>${sanitizeHtml(child.name)}</span>
                ${isLocked ? '<i class="fas fa-lock" style="font-size: 0.7rem; opacity: 0.5;"></i>' : '<i class="fas fa-chevron-right"></i>'}
            `;

            subItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isLocked) return;

                // Level 2'ye tıklandı -> Navigate -> Bu da render()'ı tetikleyecek ve DrillDown moduna geçecek
                categoryRouter.navigateToCategory(child.id);
                this.closeMobileSidebar();
            });

            content.appendChild(subItem);
        });

        container.appendChild(content);
    }

    collapseAllOthers(currentContainer) {
        const allWrappers = this.container.querySelectorAll('.accordion-wrapper');
        allWrappers.forEach(wrapper => {
            if (wrapper !== currentContainer) {
                const content = wrapper.querySelector('.accordion-content');
                if (content) content.remove();
                const icon = wrapper.querySelector('.expand-icon');
                if (icon) icon.classList.remove('rotated');
            }
        });
    }

    renderDrillDown(category) {
        // Update header (e.g., "Cars")
        if (this.headerTitle) this.headerTitle.textContent = category.name;

        const children = getChildCategories(category.id);

        // Eğer alt kategori yoksa, belki boş mesaj veya geri dön butonu?
        // Kullanıcı "sadece Cars altındakiler" dedi. Boşsa boş liste.

        const listWrapper = document.createElement('div');
        listWrapper.className = 'drill-down-list';

        // Geri Dön Butonu (Opsiyonel ama kullanışlı)
        const backBtn = document.createElement('div');
        backBtn.className = 'sidebar-category-item back-button';
        backBtn.innerHTML = `<i class="fas fa-arrow-left"></i> <span>Back</span>`;
        
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Sidebar: Back button clicked');
            // Bir üst kategoriye git
            categoryRouter.navigateUp();
        });
        listWrapper.appendChild(backBtn);

        if (children.length === 0) {
            listWrapper.innerHTML += '<div class="categories-empty" style="padding:1rem;"><p>Subcategories not found.</p></div>';
        } else {
            children.forEach(child => {
                const item = document.createElement('div');
                // Header stilini kullanalım (daha belirgin) veya sidebar-category-item
                const isLocked = child.is_locked === true;
                item.className = 'accordion-header' + (isLocked ? ' locked' : '');

                const iconClass = child.icon || 'fa-circle';
                const iconHtml = `<i class="fas ${iconClass}" style="font-size: 0.9rem;"></i>`;

                item.innerHTML = `
                    ${iconHtml}
                    <span>${sanitizeHtml(child.name)}</span>
                    <i class="fas ${isLocked ? 'fa-lock' : 'fa-chevron-right'}" style="margin-left:auto; opacity:0.5; font-size:0.8rem;"></i>
                `;

                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (isLocked) return;
                    // Level 3'e tıklandı -> Navigate
                    categoryRouter.navigateToCategory(child.id);
                    this.closeMobileSidebar();
                });

                listWrapper.appendChild(item);
            });
        }

        this.container.innerHTML = '';
        this.container.appendChild(listWrapper);
    }

    closeMobileSidebar() {
        const sidebar = document.querySelector('.sidebar-categories');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('no-scroll');
    }

    updateActiveState() {
        // Render handles selection state visually via drill-down or accordion expansion
    }
}

export async function initSidebar() {
    const loadingEl = document.querySelector('.categories-loading');

    try {
        // Kategorileri yükle
        await initializeCategories();

        // Loading elementini kaldır
        if (loadingEl) loadingEl.style.display = 'none';

        // Router'ı veriler geldikten sonra güncelle (Slug eşleşmesi için)
        categoryRouter.refresh();

        const manager = new SidebarManager();
        manager.init();
        window.sidebarManager = manager;
    } catch (error) {
        console.error('Sidebar initialization error:', error);
        if (loadingEl) {
            loadingEl.innerHTML = '<div class="error-msg" style="color:red; padding:10px;">Failed to load categories.</div>';
        }
    }
}

// Sayfaya eklendiğinde otomatik başlat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
} else {
    initSidebar();
}

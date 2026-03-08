// Breadcrumb Component - Navigation path display
import { categoryRouter } from './category-router.js';

class Breadcrumb {
    constructor() {
        this.container = document.querySelector('.breadcrumb-nav');
        if (!this.container) {
            console.warn('Breadcrumb container not found');
            return;
        }

        this.init();
    }

    init() {
        // Router'dan kategori değişikliklerini dinle
        window.addEventListener('categoryNavigated', (e) => {
            this.render(e.detail.path);
        });

        // İlk render
        this.render(categoryRouter.getCurrentPath());
    }

    /**
     * Breadcrumb'ı render et
     * @param {Array} path - Kategori path dizisi
     */
    render(path) {
        if (!this.container) return;

        if (path.length === 0) {
            // Anasayfadaysak breadcrumb'ı gizle
            this.container.style.display = 'none';
            return;
        }

        this.container.style.display = 'flex';

        const items = [];
        
        // Anasayfa linki
        items.push(`
            <a href="/" class="breadcrumb-item" data-level="0">
                <i class="fas fa-home"></i>
                <span>Anasayfa</span>
            </a>
        `);

        // Her kategori için breadcrumb item
        path.forEach((category, index) => {
            const isLast = index === path.length - 1;
            
            if (isLast) {
                // Son element - tıklanamaz
                items.push(`
                    <span class="breadcrumb-separator">
                        <i class="fas fa-chevron-right"></i>
                    </span>
                    <span class="breadcrumb-item active">
                        ${category.name}
                    </span>
                `);
            } else {
                // Ara element - tıklanabilir
                items.push(`
                    <span class="breadcrumb-separator">
                        <i class="fas fa-chevron-right"></i>
                    </span>
                    <a href="#" class="breadcrumb-item" data-level="${index + 1}">
                        ${category.name}
                    </a>
                `);
            }
        });

        this.container.innerHTML = items.join('');

        // Click event'lerini ekle
        this.container.querySelectorAll('.breadcrumb-item[data-level]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const level = parseInt(e.currentTarget.dataset.level);
                categoryRouter.navigateToLevel(level);
            });
        });
    }
}

// Initialize
export const breadcrumb = new Breadcrumb();

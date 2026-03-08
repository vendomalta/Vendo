// Category Router - URL based navigation system (Hash Routing)
import { getCategoryBySlug, getCategoryPath, getChildCategories } from './category-data.js';

class CategoryRouter {
    constructor() {
        this.currentPath = [];
        this.init();
    }

    init() {
        // URL'den kategori path'ini parse et
        this.parseCurrentUrl();

        // Hash değişimini dinle (Back/Forward ve manuel değişimler için)
        window.addEventListener('hashchange', () => {
            console.log('🔄 Hash changed:', window.location.hash);
            this.parseCurrentUrl();
            this.onCategoryChange();
        });

        // İlk yüklemede state'i güncelle (gerekirse)
        if (!window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }

    /**
     * URL'den kategori path'ini parse eder (Hash tabanlı)
     * Örnek: #/emlak/konut -> ['emlak', 'konut']
     */
    parseCurrentUrl() {
        // Hash'i al, başındaki # işaretini kaldır
        const hash = window.location.hash.substring(1); 
        // Başındaki / işaretini kaldır, boşlukları temizle
        const path = hash.replace(/^\//, '').trim();
        
        console.log('📂 Parsing URL Path:', path);
        const segments = path.split('/').filter(s => s && s !== 'index.html');

        this.currentPath = [];

        // Her segment için kategori bul ve path'e ekle
        for (const slug of segments) {
            const category = getCategoryBySlug(slug);
            if (category) {
                this.currentPath.push(category);
            } else {
                console.warn('⚠️ Kategori bulunamadı:', slug);
            }
        }
        console.log('✅ Current Path Resolved:', this.currentPath);
    }

    /**
     * Kategoriye navigate et
     * @param {number} categoryId - Kategori ID
     */
    navigateToCategory(categoryId) {
        const categoryPath = getCategoryPath(categoryId);

        // URL oluştur (Hash tabanlı)
        const url = '#/' + categoryPath.map(cat => cat.slug).join('/');

        // Hash'i güncelle (bu otomatik olarak hashchange eventini tetikler)
        window.location.hash = url;
        
        // Manuel update gerekmez, hashchange halleder ama
        // hemen state güncellemek için:
        this.currentPath = categoryPath;
        // this.onCategoryChange(); // hashchange event'i bunu zaten çağıracak
    }

    /**
     * Anasayfaya dön
     */
    navigateToHome() {
        // Hash'i temizle
        history.pushState(null, '', window.location.pathname + window.location.search);
        this.currentPath = [];
        this.onCategoryChange();
    }

    /**
     * Breadcrumb'dan belirli bir seviyeye tıklandığında
     * @param {number} level - Seviye (0 = anasayfa)
     */
    navigateToLevel(level) {
        if (level === 0) {
            this.navigateToHome();
            return;
        }

        const targetPath = this.currentPath.slice(0, level);
        const url = '#/' + targetPath.map(cat => cat.slug).join('/');

        window.location.hash = url;
    }

    /**
     * Bir üst kategoriye (parent) git
     */
    navigateUp() {
        if (this.currentPath.length === 0) return;

        // Mevcut path'in son elemanını çıkar
        const targetPath = this.currentPath.slice(0, this.currentPath.length - 1);

        if (targetPath.length > 0) {
            const url = '#/' + targetPath.map(cat => cat.slug).join('/');
            window.location.hash = url;
        } else {
            this.navigateToHome();
        }
    }

    /**
     * Mevcut kategorinin alt kategorilerini döndürür
     */
    getCurrentChildren() {
        if (this.currentPath.length === 0) {
            // Anasayfadaysak, root kategorileri döndür
            return getChildCategories(null);
        }

        // Son kategorinin alt kategorilerini döndür
        const currentCategory = this.currentPath[this.currentPath.length - 1];
        return getChildCategories(currentCategory.id);
    }

    /**
     * Mevcut path'i döndürür (breadcrumb için)
     */
    getCurrentPath() {
        return this.currentPath;
    }

    /**
     * Kategori değiştiğinde çağrılır
     */
    onCategoryChange() {
        // Event dispatch et - sidebar ve breadcrumb dinleyecek
        const event = new CustomEvent('categoryNavigated', {
            detail: {
                path: this.currentPath,
                children: this.getCurrentChildren()
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Mevcut derinlik seviyesini döndürür
     */
    getCurrentLevel() {
        return this.currentPath.length;
    }

    /**
     * Mevcut kategoriyi döndürür
     */
    getCurrentCategory() {
        return this.currentPath.length > 0
            ? this.currentPath[this.currentPath.length - 1]
            : null;
    }
    /**
     * Kategoriler yüklendikten sonra path'i tekrar parse et
     */
    refresh() {
        this.parseCurrentUrl();
        this.onCategoryChange();
    }
}

// Singleton instance
export const categoryRouter = new CategoryRouter();

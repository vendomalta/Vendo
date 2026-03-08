/**
 * URL ↔ Kategori Senkronizasyonu
 * Seçilen kategoriler adres çubuğunda ?cat=... olarak tutulur
 */

/**
 * Seçili kategorileri URL'ye yaz
 * @param {Array<string>} categories - Kategori adları
 */
export function writeCategoryToUrl(categories = []) {
    try {
        const url = new URL(window.location.href);
        if (categories && categories.length > 0) {
            url.searchParams.set('cat', categories.join(','));
        } else {
            url.searchParams.delete('cat');
        }
        window.history.replaceState(null, '', url.toString());
    } catch (_) {}
}

/**
 * URL'den kategorileri oku
 * @returns {Array<string>} Kategori adları (yoksa boş array)
 */
export function readCategoryFromUrl() {
    try {
        const url = new URL(window.location.href);
        const catStr = url.searchParams.get('cat');
        if (catStr) {
            return catStr.split(',').filter(Boolean);
        }
    } catch (_) {}
    return [];
}

/**
 * URL'de kategori var mı kontrol et
 */
export function hasCategoryInUrl() {
    return readCategoryFromUrl().length > 0;
}

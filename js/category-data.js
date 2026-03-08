// Flat parent-child category structure
// Supabase'den dinamik olarak yüklenecek
import { getCategories } from './api.js';

export let categories = [];

// Kategorileri yükle ve dışa aktarılan değişkeni güncelle
export async function initializeCategories() {
    try {
        const data = await getCategories();
        if (data && data.length > 0) {
            // Data mapping for compatibility (Supabase returns snake_case, app uses camelCase)
            categories = data.map(cat => ({
                ...cat,
                parentId: cat.parent_id !== undefined ? cat.parent_id : cat.parentId,
                iconColor: cat.icon_color || cat.iconColor
            }));
            console.log(`Kategoriler yüklendi: ${categories.length} adet`);
        } else {
            console.warn('Kategori verisi boş geldi!');
        }
    } catch (error) {
        console.error('Kategori başlatma hatası:', error);
    }
    return categories;
}

// Helper fonksiyonlar
export const getCategoryById = (id) => categories.find(cat => cat.id === id);
export const getCategoryByName = (name) => categories.find(cat => cat.name === name);
export const getCategoryBySlug = (slug) => categories.find(cat => cat.slug === slug);
export const getChildCategories = (parentId) => categories.filter(cat => cat.parentId === parentId);
export const getRootCategories = () => categories.filter(cat => cat.parentId === null);
export const getCategoryPath = (categoryId) => {
    const path = [];
    let current = getCategoryById(categoryId);

    while (current) {
        path.unshift(current);
        current = current.parentId ? getCategoryById(current.parentId) : null;
    }

    return path;
};

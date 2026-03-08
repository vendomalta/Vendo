// Arama ve Filtreleme Sistemi
import { getListings } from './api.js';

// Arama ve filtreleme state
let currentFilters = {
    search: '',
    category: null,
    location: '',
    minPrice: null,
    maxPrice: null,
    currency: 'EUR'
};

export function initializeSearchAndFilters() {
    console.log('🔍 initializeSearchAndFilters başlatılıyor...');
    
    // Header yüklenene kadar bekle
    const initFilters = () => {
        console.log('🔍 initFilters çalıştırılıyor...');
        const searchBox = document.querySelector('.search-input');
        const searchButton = document.querySelector('.search-icon');
        const filterPanel = document.getElementById('filterPanel');
        
        // Arama butonu (veya ikonu)
        if (searchBox) {
            console.log('✅ Arama kutusu bulundu.');
            if (searchButton) {
                console.log('✅ Arama ikonu bulundu.');
                searchButton.style.cursor = 'pointer';
                searchButton.addEventListener('click', () => {
                    const query = searchBox.value.trim();
                    console.log('🔍 Arama ikonuna tıklandı, aranan:', query);
                    if (window.loadListings) {
                        window.loadListings(true, { search: query });
                    }
                });
            }
            
            // Enter tuşu ile arama
            searchBox.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const query = searchBox.value.trim();
                    console.log('🔍 Enter tuşuna basıldı, aranan:', query);
                    if (window.loadListings) {
                        window.loadListings(true, { search: query });
                    }
                }
            });
        } else {
            console.warn('⚠️ Arama kutusu (.search-input) bulunamadı!');
        }
        
        // Filtre uygula butonu
        if (filterPanel) {
            const applyBtn = filterPanel.querySelector('.btn-primary');
            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    applyFilters();
                    filterPanel.classList.remove('active');
                });
            }
            
            // Temizle butonu
            const clearBtn = filterPanel.querySelector('.btn-secondary');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    clearFilters();
                });
            }
        }
        
        // Kategori kartları (ana sayfa)
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const categoryText = card.querySelector('h3').textContent.toLowerCase();
                const category = mapCategoryName(categoryText);
                if (window.loadListings) {
                    window.loadListings(true, { category });
                }
            });
        });
    };
    
    // Header yüklendiyse hemen çalıştır, yoksa eventi bekle
    const headerPlaceholder = document.getElementById('header-placeholder');
    const isHeaderLoaded = headerPlaceholder && headerPlaceholder.dataset.loaded === 'true';
    
    if (isHeaderLoaded || document.getElementById('filterPanel')) {
        initFilters();
    } else {
        document.addEventListener('headerLoaded', initFilters);
    }
}

function applyFilters() {
    const filterPanel = document.getElementById('filterPanel');
    if (!filterPanel) return;

    // Konum filtreleri
    const citySelect = filterPanel.querySelector('.location-picker select');

    let location = '';
    if (citySelect && citySelect.selectedIndex > 0) {
        location = citySelect.value;
    }
    currentFilters.location = location;

    // Fiyat filtreleri
    const minPriceInput = filterPanel.querySelector('.price-range input:nth-child(1)');
    const maxPriceInput = filterPanel.querySelector('.price-range input:nth-child(3)');

    if (minPriceInput) currentFilters.minPrice = minPriceInput.value || null;
    if (maxPriceInput) currentFilters.maxPrice = maxPriceInput.value || null;
    
    if (window.loadListings) {
        window.loadListings(true, { 
            location: currentFilters.location,
            minPrice: currentFilters.minPrice ? parseFloat(currentFilters.minPrice) : undefined,
            maxPrice: currentFilters.maxPrice ? parseFloat(currentFilters.maxPrice) : undefined
        });
    }
}

function clearFilters() {
    currentFilters = {
        search: '',
        category: null,
        location: '',
        minPrice: null,
        maxPrice: null,
        currency: 'EUR'
    };

    // Input alanlarını temizle
    const filterPanel = document.getElementById('filterPanel');
    if (filterPanel) {
        filterPanel.querySelectorAll('input').forEach(input => input.value = '');
        filterPanel.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
    }

    const searchBox = document.querySelector('.search-input');
    if (searchBox) searchBox.value = '';

    if (window.loadListings) {
        window.loadListings(true, {});
    }
}

function mapCategoryName(name) {
    const map = {
        'konut': 'emlak',
        'vasıta': 'vasita',
        'iş yeri': 'emlak',
        'ev eşyası': 'ev_esyasi',
        'elektronik': 'elektronik',
        'giyim': 'giyim',
        'hobi': 'hobi',
        'iş ilanları': 'is_ilanlari'
    };
    return map[name] || null;
}

// Global erişim için (layout.js vb. için)
window.initializeSearchAndFilters = initializeSearchAndFilters;
window.initializeFilters = initializeSearchAndFilters; 

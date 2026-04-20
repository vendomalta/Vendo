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
                    if (query) saveSearch(query);
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
                    if (query) saveSearch(query);
                    if (window.loadListings) {
                        window.loadListings(true, { search: query });
                    }
                    hideRecentSearches();
                }
            });

            // Recent search logic
            searchBox.addEventListener('focus', () => {
                if (!searchBox.value.trim()) {
                    showRecentSearches();
                }
            });

            searchBox.addEventListener('input', () => {
                if (!searchBox.value.trim()) {
                    showRecentSearches();
                } else {
                    hideRecentSearches();
                }
            });

            document.addEventListener('click', (e) => {
                if (!searchBox.contains(e.target) && !document.getElementById('recentSearchesDropdown')?.contains(e.target)) {
                    hideRecentSearches();
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


function saveSearch(query) {
    if (!query) return;
    let searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    searches = [query, ...searches.filter(s => s !== query)].slice(0, 5);
    localStorage.setItem('recentSearches', JSON.stringify(searches));
}

function showRecentSearches() {
    const searchBox = document.querySelector('.search-input');
    if (!searchBox) return;

    let searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    if (searches.length === 0) return;

    let dropdown = document.getElementById('recentSearchesDropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'recentSearchesDropdown';
        dropdown.className = 'recent-searches-dropdown';
        // Position it under the search box
        const rect = searchBox.getBoundingClientRect();
        dropdown.style.cssText = `
            position: absolute;
            top: ${rect.bottom + window.scrollY + 5}px;
            left: ${rect.left}px;
            width: ${rect.width}px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            padding: 8px 0;
        `;
        document.body.appendChild(dropdown);
    }

    dropdown.innerHTML = `
        <div style="padding: 8px 16px; font-size: 12px; color: #64748b; font-weight: 600;">RECENT SEARCHES</div>
        ${searches.map(s => `
            <div class="recent-search-item" style="padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s;">
                <i class="fas fa-history" style="color: #94a3b8; font-size: 14px;"></i>
                <span style="color: #1e293b; font-size: 14px;">${s}</span>
            </div>
        `).join('')}
        <div id="clearSearches" style="padding: 10px 16px; cursor: pointer; color: #ef4444; font-size: 13px; text-align: center; border-top: 1px solid #f1f5f9; margin-top: 4px;">Clear History</div>
    `;

    dropdown.style.display = 'block';

    // Item click
    dropdown.querySelectorAll('.recent-search-item').forEach((item, idx) => {
        item.addEventListener('click', () => {
            searchBox.value = searches[idx];
            if (window.loadListings) {
                window.loadListings(true, { search: searches[idx] });
            }
            hideRecentSearches();
        });
        item.addEventListener('mouseenter', () => item.style.background = '#f8fafc');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    });

    // Clear click
    document.getElementById('clearSearches').addEventListener('click', () => {
        localStorage.removeItem('recentSearches');
        hideRecentSearches();
    });
}

function hideRecentSearches() {
    const dropdown = document.getElementById('recentSearchesDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

// Global erişim için (layout.js vb. için)
window.initializeSearchAndFilters = initializeSearchAndFilters;
window.initializeFilters = initializeSearchAndFilters; 

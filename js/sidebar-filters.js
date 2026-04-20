// Sidebar Filtreleme Yöneticisi
import { supabase } from './supabase.js';
import { getCategoryById } from './category-data.js';

class SidebarFiltersManager {
    constructor() {
        this.container = document.getElementById('sidebarFilters');
        this.currentCategoryId = null;
        this.currentFilters = {
            city: [],
            minPrice: '',
            maxPrice: '',
            extraFields: {}
        };
        this.debounceTimeout = null;
        this.isCollapsed = false; // Master toggle state
        this.maltaCities = [
            'Attard', 'Balzan', 'Birgu', 'Birkirkara', 'Birżebbuġa', 'Bormla', 'Dingli', 'Fgura', 'Floriana', 'Fontana (Gozo)', 'Għajnsielem (Gozo)', 'Għarb (Gozo)', 'Għargħur', 'Għasri (Gozo)', 'Għaxaq', 'Gżira', 'Hamrun', 'Iklin', 'Isla', 'Kalkara', 'Kerċem (Gozo)', 'Kirkop', 'Lija', 'Luqa', 'Marsaskala', 'Marsaxlokk', 'Mdina', 'Mellieħa', 'Mġarr', 'Mosta', 'Mqabba', 'Msida', 'Mtarfa', 'Munxar (Gozo)', 'Nadur (Gozo)', 'Naxxar', 'Paola', 'Pembroke', 'Pietà', 'Qala (Gozo)', 'Qormi', 'Qrendi', 'Rabat', 'Rabat (Gozo)', 'Safi', 'San Ġiljan', 'San Gwann', 'San Lawrenz (Gozo)', 'San Pawl il-Baħar', 'Sannat (Gozo)', 'Santa Luċija', 'Santa Venera', 'Siġġiewi', 'Sliema', "St. Paul's Bay", 'Swieqi', "Ta' Xbiex", 'Tarxien', 'Valletta', 'Xagħra (Gozo)', 'Xewkija (Gozo)', 'Xgħajra', 'Żabbar', 'Żebbuġ', 'Żebbuġ (Gozo)', 'Żejtun', 'Żurrieq', 'Other'
        ];
    }

    getInheritedConfig(categoryId) {
        if (!categoryId) return null;
        
        let current = getCategoryById(categoryId);
        // Fallback for ID type mismatch
        if (!current) current = getCategoryById(String(categoryId)) || getCategoryById(Number(categoryId));
        
        let allFields = [];
        let seenNames = new Set();
        
        // Root categories (level 0) should NOT show dynamic filters as per user request
        const targetCategory = current;
        // Use loose check for level and parentId
        if (targetCategory && (Number(targetCategory.level) === 0 || !targetCategory.parentId)) {
            console.log('Root category selected or no parent, skipping dynamic filters:', targetCategory.name);
            return null;
        }

        while (current) {
            const config = typeof current.extra_fields_config === 'string' 
                ? JSON.parse(current.extra_fields_config) 
                : current.extra_fields_config;
                
            if (config && config.fields) {
                // Filtrable fields from current level
                const filtrableFields = config.fields.filter(f => f.isFilter !== false); 
                
                filtrableFields.forEach(f => {
                    if (!seenNames.has(f.name)) {
                        allFields.push(f);
                        seenNames.add(f.name);
                    }
                });
            }
            
            // Move up the tree
            const nextId = current.parentId;
            current = nextId ? (getCategoryById(nextId) || getCategoryById(String(nextId)) || getCategoryById(Number(nextId))) : null;
        }
        
        return allFields.length > 0 ? { fields: allFields } : null;
    }

    init() {
        if (!this.container) return;

        // Try to get current category from router if it already exists
        setTimeout(() => {
            if (window.categoryRouter) {
                const currentCat = window.categoryRouter.getCurrentCategory();
                if (currentCat && currentCat.id) {
                    this.currentCategoryId = currentCat.id;
                    this.render();
                }
            }
        }, 500);

        // Kategori değişimini dinle
        window.addEventListener('categoryNavigated', (e) => {
            const { path } = e.detail;
            const newCategoryId = path.length > 0 ? path[path.length - 1].id : null;
            
            if (newCategoryId !== this.currentCategoryId) {
                this.currentCategoryId = newCategoryId;
                // Şehri temizleme (isteğe bağlı, ama genelde kategoriler arası şehir kalabilir)
                // this.currentFilters.city = '';
                this.render();
            }
        });

        this.render();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="filter-action-zone">
                <button id="sideSearchBtn" class="btn-sidebar-search">Search</button>
            </div>
            
            <!-- Konum Filtresi -->
            <div class="filter-accordion active">
                <div class="filter-accordion-header">
                    <h4>Location</h4>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="filter-accordion-content">
                    <div class="location-checkboxes">
                        ${this.maltaCities.map(city => `
                            <label class="filter-checkbox-item">
                                <input type="checkbox" class="city-checkbox" value="${city.toLowerCase().replace(/\s+/g, '-')}" ${this.currentFilters.city.includes(city.toLowerCase().replace(/\s+/g, '-')) ? 'checked' : ''}>
                                <span>${city}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="filter-accordion active">
                <div class="filter-accordion-header">
                    <h4>Price</h4>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="filter-accordion-content">
                    <div class="price-inputs">
                        <div class="price-input-wrapper">
                            <input type="text" id="sideMinPrice" placeholder="Min" value="${this.currentFilters.minPrice ? this.currentFilters.minPrice.toLocaleString('en-MT') : ''}">
                        </div>
                        <div class="price-input-wrapper">
                            <input type="text" id="sideMaxPrice" placeholder="Max" value="${this.currentFilters.maxPrice ? this.currentFilters.maxPrice.toLocaleString('en-MT') : ''}">
                        </div>
                    </div>
                </div>
            </div>

            <div id="dynamicFilterAccordions"></div>
            
            <a class="clear-filters-link" id="clearSideFilters">Clear Filters</a>
        `;

        this.renderDynamicFields();
        // bindEvents already calls bindAccordionToggle for the entire container
        this.bindEvents();
    }

    async renderDynamicFields() {
        const dynamicContainer = document.getElementById('dynamicFilterAccordions');
        if (!dynamicContainer) return;
        
        dynamicContainer.innerHTML = ''; // Start clean

        if (!this.currentCategoryId) return;

        const config = this.getInheritedConfig(this.currentCategoryId);
        if (!config || !config.fields || config.fields.length === 0) {
            console.log('No inherited filters for category:', this.currentCategoryId, 'config:', config);
            return;
        }
        
        console.log('Rendering dynamic filters:', config.fields.length, 'fields');

        let html = '';
        config.fields.forEach(field => {
            const value = this.currentFilters.extraFields[field.name] || '';
            html += `
                <div class="filter-accordion">
                    <div class="filter-accordion-header">
                        <h4>${field.label}</h4>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="filter-accordion-content">
                        ${this.renderFieldInput(field, value)}
                    </div>
                </div>
            `;
        });

        dynamicContainer.innerHTML = html;
        this.renderTechDetails();
        this.bindAccordionToggle(); // Re-bind for dynamic elements
        this.bindDynamicEvents();
    }

    renderTechDetails() {
        const dynamicContainer = document.getElementById('dynamicFilterAccordions');
        if (!this.currentCategoryId) return;

        const category = getCategoryById(this.currentCategoryId);
        if (!category) return;

        const mainCat = category.parentId ? getCategoryById(category.parentId) : category;
        const mainName = (mainCat.name || '').toLowerCase();
        
        // Sadece Vasıta/Vehicles kategorisinde teknik detayları göster
        if (!(mainName.includes('vasıta') || mainName.includes('vehicle') || mainName.includes('otomobil'))) return;

        const carTechDetails = {
            'Security': ['ABS', 'AEB', 'BAS', 'ESP / VSA', 'Hill Start Assist', 'Lane Keeping System'],
            'Interior': ['A/C', 'Cruise Control', 'Reverse Camera', 'Leather Seats', 'Sunroof'],
            'Multimedia': ['Bluetooth', 'Navigation', 'Apple CarPlay', 'Android Auto']
        };

        let html = '';
        Object.entries(carTechDetails).forEach(([groupName, features]) => {
            html += `
                <div class="filter-accordion">
                    <div class="filter-accordion-header">
                        <h4>${groupName}</h4>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="filter-accordion-content">
                        <div class="tech-filter-grid">
                            ${features.map(f => {
                                const isChecked = (this.currentFilters.extraFields.technical_details || []).includes(f);
                                return `
                                    <label class="tech-filter-item">
                                        <input type="checkbox" class="tech-checkbox" value="${f}" ${isChecked ? 'checked' : ''}>
                                        <span>${f}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        dynamicContainer.insertAdjacentHTML('beforeend', html);
    }

    renderFieldInput(field, value) {
        if (field.type === 'select' && field.options) {
            return `
                <select class="filter-field dynamic-filter" data-name="${field.name}">
                    <option value="">All</option>
                    ${field.options.map(opt => `
                        <option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                </select>
            `;
        } else if (field.name === 'kilometre') {
            // KM için özel render (Unit seçimi ile)
            return `
                <div class="km-filter-wrapper">
                    <input type="number" class="filter-field dynamic-filter" data-name="kilometre" placeholder="KM" value="${value}">
                    <select class="filter-field dynamic-filter" data-name="kilometre_unit" style="flex: 0 0 70px;">
                        <option value="km" ${this.currentFilters.extraFields.kilometre_unit === 'km' ? 'selected' : ''}>KM</option>
                        <option value="mil" ${this.currentFilters.extraFields.kilometre_unit === 'mil' ? 'selected' : ''}>Mil</option>
                    </select>
                </div>
            `;
        } else if (field.type === 'number') {
            return `<input type="number" class="filter-field dynamic-filter" data-name="${field.name}" placeholder="${field.label}" value="${value}">`;
        } else {
            return `<input type="text" class="filter-field dynamic-filter" data-name="${field.name}" placeholder="${field.label}" value="${value}">`;
        }
    }

    bindAccordionToggle() {
        if (this._hasAccordionDelegation) return; // Prevent multiple bindings

        this.container.addEventListener('click', (e) => {
            const header = e.target.closest('.filter-accordion-header');
            if (header && this.container.contains(header)) {
                const accordion = header.closest('.filter-accordion');
                if (accordion) accordion.classList.toggle('active');
            }
        });

        this._hasAccordionDelegation = true;
    }

    bindEvents() {
        const searchBtn = document.getElementById('sideSearchBtn');
        const cityCheckboxes = document.querySelectorAll('.city-checkbox');
        const minInput = document.getElementById('sideMinPrice');
        const maxInput = document.getElementById('sideMaxPrice');
        const clearBtn = document.getElementById('clearSideFilters');

        searchBtn?.addEventListener('click', () => {
            this.executeSearch();
        });

        cityCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const val = cb.value;
                if (!Array.isArray(this.currentFilters.city)) {
                    this.currentFilters.city = [];
                }
                
                if (cb.checked) {
                    if (!this.currentFilters.city.includes(val)) {
                        this.currentFilters.city.push(val);
                    }
                } else {
                    this.currentFilters.city = this.currentFilters.city.filter(c => c !== val);
                }
            });
        });

        // Fiyat değişimlerini state'e aktar
        const handlePriceInput = (e, filterKey) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            if (val === '') {
                this.currentFilters[filterKey] = '';
                e.target.value = '';
                return;
            }
            const num = parseInt(val);
            this.currentFilters[filterKey] = num;
            e.target.value = num.toLocaleString('en-MT');
        };

        minInput?.addEventListener('input', (e) => handlePriceInput(e, 'minPrice'));
        maxInput?.addEventListener('input', (e) => handlePriceInput(e, 'maxPrice'));

        clearBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.clearFilters();
        });

        // Master Toggle Listener
        const masterToggleBtn = document.getElementById('toggleFiltersBtn');
        if (masterToggleBtn) {
            masterToggleBtn.addEventListener('click', () => {
                this.isCollapsed = !this.isCollapsed;
                const filtersContent = document.getElementById('sidebarFilters');
                const icon = masterToggleBtn.querySelector('.expand-icon');
                
                if (this.isCollapsed) {
                    filtersContent.classList.add('collapsed');
                    icon.classList.add('rotated');
                } else {
                    filtersContent.classList.remove('collapsed');
                    icon.classList.remove('rotated');
                }
            });
        }

        this.bindAccordionToggle();
    }

    bindDynamicEvents() {
        const fields = this.container.querySelectorAll('.dynamic-filter');
        fields.forEach(field => {
            const updateState = () => {
                const name = field.dataset.name;
                this.currentFilters.extraFields[name] = field.value;
            };

            field.addEventListener('change', updateState);
            if (field.tagName === 'INPUT') {
                field.addEventListener('input', updateState);
            }
        });

        // Teknik detay checkboxları
        const techChecks = this.container.querySelectorAll('.tech-checkbox');
        techChecks.forEach(cb => {
            cb.addEventListener('change', () => {
                if (!this.currentFilters.extraFields.technical_details) {
                    this.currentFilters.extraFields.technical_details = [];
                }
                const val = cb.value;
                if (cb.checked) {
                    if (!this.currentFilters.extraFields.technical_details.includes(val)) {
                        this.currentFilters.extraFields.technical_details.push(val);
                    }
                } else {
                    this.currentFilters.extraFields.technical_details = this.currentFilters.extraFields.technical_details.filter(v => v !== val);
                }
            });
        });
    }

    executeSearch() {
        if (window.loadListings) {
            window.loadListings(true, {
                location: this.currentFilters.city,
                minPrice: this.currentFilters.minPrice ? parseFloat(this.currentFilters.minPrice) : undefined,
                maxPrice: this.currentFilters.maxPrice ? parseFloat(this.currentFilters.maxPrice) : undefined,
                extraFields: this.currentFilters.extraFields
            });
        }
    }

    clearFilters() {
        this.currentFilters = {
            city: [],
            minPrice: '',
            maxPrice: '',
            extraFields: {}
        };
        this.render();
        if (window.loadListings) {
            window.loadListings(true, {});
        }
    }
}

export const sidebarFilters = new SidebarFiltersManager();

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
    sidebarFilters.init();
});

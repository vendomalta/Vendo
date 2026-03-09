
// Merge base fields with template fields, avoiding duplicate field names.
import { getCategoryById, getCategoryBySlug, getCategoryByName, initializeCategories } from './category-data.js';

function getInheritedFields(detailOrCategory) {
    let current = typeof detailOrCategory === 'object' ? detailOrCategory : getCategoryByName(detailOrCategory);
    let allFields = [];
    let seenNames = new Set();
    
    while (current) {
        const config = typeof current.extra_fields_config === 'string' 
            ? JSON.parse(current.extra_fields_config) 
            : current.extra_fields_config;
            
        if (config && config.fields) {
            (config.fields || []).forEach(f => {
                if (!seenNames.has(f.name)) {
                    allFields.push(f);
                    seenNames.add(f.name);
                }
            });
        }
        current = current.parentId ? getCategoryById(current.parentId) : null;
    }
    return allFields;
}
function mergeFieldsWithTemplates(baseFields, template) {
    try {
        if (!template || !Array.isArray(template.fields) || template.fields.length === 0) return baseFields;
        const existing = new Set((baseFields || []).map(f => f.name));
        const merged = (baseFields || []).slice();
        for (const f of template.fields) {
            if (!f || !f.name) continue;
            if (!existing.has(f.name)) {
                merged.push(f);
                existing.add(f.name);
            }
        }
        return merged;
    } catch (err) {
        console.warn('mergeFieldsWithTemplates hata:', err);
        return baseFields;
    }
}

const enrichmentTemplates = {
    // Real estate common fields (used for the "Real Estate" main category)
    RealEstateCommon: {
        fields: [
            { name: 'takas', label: 'Exchange', type: 'select', options: ['Yes', 'No'], required: true },
            { name: 'listing_owner', label: 'Listing Owner:', type: 'select', options: ['Owner', 'Agency', 'Other'], required: true },
        ]
    },
    VehiclesCommon: { fields: [] },
    PartsAccessoriesCommon: { fields: [] },
    SecondHandCommon: { fields: [] },
    PetsCommon: { fields: [] },
    TechnologyCommon: { fields: [] },
};
//------------------------------------------------------------------------------
// Category field configurations (Real Estate examples)
// Config removed - fetching from DB now

// ==========================================
// TEKNİK DETAYLAR (ARAÇ) VERİSİ
// ==========================================
const carTechDetails = {
    'Security': [
        'ABS', 'AEB', 'BAS', 'Child Lock', 'Distronic', 'ESP / VSA', 'Night Vision System',
        'Airbag (Driver)', 'Airbag (Passenger)', 'Immobilizer', 'Isofix',
        'Blind Spot Warning System', 'Central Locking', 'Lane Tracking System',
        'Hill Start Assist', 'Fatigue Detection System', 'Armored Vehicle'
    ],
    'Interior': [
        'Adaptive Cruise Control', 'Keyless Entry & Start', 'Leather Seats',
        'Electric Windows', 'Functional Steering Wheel', 'Rear View Camera', 'Head-up Display',
        'Cruise Control', 'Power Steering', 'Heated Steering Wheel', 'Air Conditioning',
        'Electric Seats', 'Memory Seats', 'Heated Seats',
        'Ventilated Seats', 'Fabric Seats', 'Auto-Dimming Rearview Mirror', 'Front View Camera',
        'Front Armrest', 'Cooled Glove Box', 'Start / Stop', 'Third Row Seats',
        'Trip Computer'
    ],
    'Exterior': [
        'Hands-Free Tailgate', 'Hardtop', 'Adaptive Headlights', 'Electric Mirrors',
        'Heated Mirrors', 'Memory Mirrors', 'Rear Parking Sensor', 'Front Parking Sensor',
        'Parking Assistant', 'Sunroof', 'Smart Tailgate', 'Panoramic Roof', 'Tow Hitch'
    ],
    'Multimedia': [
        'Android Auto', 'Apple CarPlay', 'Bluetooth', 'USB / AUX', 'Navigation',
        'Sound System', 'TV', 'Wireless Charging'
    ]
};

// State management
let selectedCategory = null;
let editingListing = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Auth Guard
    const { supabase } = await import('./supabase.js');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        console.warn('Unauthorized access to ad form. Redirecting...');
        window.location.href = 'login.html?redirect=ilan-ver-form.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const listingId = params.get('id');

    // Initialize categories first
    await initializeCategories();

    if (listingId) {
        await loadListingForEdit(listingId);
    } else {
        await loadCategoryFromSession();
    }

    setupFormListeners();
    updateProgress();

    // Start form validation (ensure the correct form id)
    if (typeof FormValidator !== 'undefined') {
        const formValidator = new FormValidator('#listingForm');
    } else {
        console.warn('FormValidator is not defined, skipping validation init.');
    }
});

// Load category from sessionStorage and refetch full data to ensure config is fresh
async function loadCategoryFromSession() {
    // Edit modunda kategori zaten set edildiyse session'a bakma
    if (selectedCategory && selectedCategory.extra_fields_config) {
        displayCategoryInfo();
        renderCategorySpecificFields();
        renderTechDetails(); 
        return;
    }

    console.log('loadCategoryFromSession called');

    const categoryData = sessionStorage.getItem('selectedCategory');
    console.log('Read from sessionStorage:', categoryData);

    if (!categoryData) {
        console.log('⚠️ No category data found - defaulting to Cars');
        // Use a default category instead of redirecting
        selectedCategory = {
            path: ['Vehicles', 'Cars', 'Cars'],
            selectedId: 102,
            selectedCategory: { name: 'Cars', level: 2 }
        };
    } else {
        const parsed = JSON.parse(categoryData);
        // Support both old and new formats
        if (parsed.path && parsed.selectedId) {
            selectedCategory = parsed;
        } else if (parsed.main && parsed.sub && parsed.detail) {
            selectedCategory = {
                path: [parsed.main, parsed.sub, parsed.detail],
                selectedId: null,
                selectedCategory: { name: parsed.detail, level: 2 }
            };
        } else {
            selectedCategory = parsed;
        }
    }

    // CRITICAL: Refetch the category from the database to ensure we have the latest extra_fields_config
    const categoryId = selectedCategory.selectedId || selectedCategory.id;
    if (categoryId) {
        try {
            const { supabase } = await import('./supabase.js');
            const { data: fullCategory, error } = await supabase
                .from('categories')
                .select('*')
                .eq('id', categoryId)
                .single();
            
            if (fullCategory && !error) {
                console.log('Full category data refetched:', fullCategory);
                // Merge full category data into selectedCategory
                selectedCategory = {
                    ...selectedCategory,
                    ...fullCategory
                };
            }
        } catch (e) {
            console.error('Error refetching category data:', e);
        }
    }

    console.log('Selected category (final):', selectedCategory);

    displayCategoryInfo();
    renderCategorySpecificFields();
    renderTechDetails(); // Teknik detayları render et
}

async function loadListingForEdit(listingId) {
    try {
        const { supabase } = await import('./supabase.js');
        const { data: listing, error } = await supabase
            .from('listings')
            .select('*')
            .eq('id', listingId)
            .single();

        if (error || !listing) {
            console.warn('Listing not found, returning to category page');
            loadCategoryFromSession();
            return;
        }

        editingListing = listing;

        // Infer category from listing
        const inferredCategory = inferCategoryFromListing(listing);
        selectedCategory = inferredCategory;
        sessionStorage.setItem('selectedCategory', JSON.stringify(selectedCategory));

        displayCategoryInfo();
        renderCategorySpecificFields();
        renderTechDetails(); // Teknik detayları render et
        prefillFormWithListing(listing);
    } catch (err) {
        console.error('Error loading listing:', err);
        loadCategoryFromSession();
    }
}

function inferCategoryFromListing(listing) {
    const category = listing.category_id || 'Genel';
    const lc = category.toLowerCase();
    let main = 'Genel';
    let sub = 'Genel';
    let detail = category;

    // Determine main groups based on category
    if (lc.includes('emlak') || lc.includes('konut') || lc.includes('daire') || lc.includes('ev') || lc.includes('real estate') || lc.includes('residential')) {
        // New main category name is 'Real Estate' in category-data.js
        main = 'Real Estate';
        sub = 'Residential';
        detail = 'Residential';
    } else if (lc.includes('otomobil') || lc.includes('araç') || lc.includes('vasıta') || lc.includes('araba') || lc.includes('cars') || lc.includes('vehicles')) {
        main = 'Vehicles';
        // But first check if an exact match exists
        const cat = getCategoryByName(category);
        if (cat && cat.extra_fields_config && cat.extra_fields_config.fields && cat.extra_fields_config.fields.length > 0) {
            detail = category; // Exact match found
        } else if (lc.includes('elektrik') || lc.includes('electric')) {
            detail = 'Cars'; // Electric but brand not specified
            sub = 'Electric';
        } else {
            detail = 'Cars'; // Base cars
            sub = 'Cars';
        }
    } else if (lc.includes('hayvan') || lc.includes('evcil') || lc.includes('pets')) {
        main = 'Pets';
        sub = 'Pets';
    } else if (lc.includes('elektronik') || lc.includes('technology')) {
        main = 'Technology';
        sub = 'Technology';
    }

    return {
        main,
        sub,
        detail
    };
}

function prefillFormWithListing(listing) {
    // Basic fields
    const titleInput = document.getElementById('title');
    if (titleInput) titleInput.value = listing.title || '';

    // Description: if rich editor present, set its html; otherwise set textarea
    const descriptionEditor = document.getElementById('descriptionEditor');
    const descriptionInput = document.getElementById('description');
    if (descriptionEditor) {
        descriptionEditor.innerHTML = listing.description || '';
        // also set hidden textarea so direct reads work
        if (descriptionInput) descriptionInput.value = listing.description || '';
    } else if (descriptionInput) {
        descriptionInput.value = listing.description || '';
    }

    const priceInput = document.getElementById('price');
    if (priceInput && listing.price) priceInput.value = listing.price;

    const citySelect = document.getElementById('city');
    if (citySelect && listing.location_city) {
        const normalized = (listing.location_city || '').toLowerCase();
        const matchOption = Array.from(citySelect.options).find(opt => opt.value && normalized.includes(opt.value.toLowerCase()));
        if (matchOption) citySelect.value = matchOption.value;
    }

    // Category fields
    const extra = listing.extra_fields || {};
    const aliases = {
        marka: ['brand', 'marka'],
        model: ['model_name', 'model'],
        yil: ['year', 'yıl', 'yil'],
        kilometre: ['km', 'kilometer', 'kilometre', 'km_sayisi'],
        kilometre_unit: ['kilometre_unit', 'km_unit', 'unit'],
        yakit: ['fuel', 'yakıt', 'fuel_type', 'yakit'],
        motor_hacmi: ['engine_size', 'motor_hacmi', 'motor_hacimleri', 'engine_cc'],
        motor_gucu: ['horsepower', 'motor_gucu', 'motor_gücü', 'hp', 'beygir'],
        cekis: ['drive_type', 'cekis', 'çekiş'],
        vites: ['transmission', 'vites'],
        renk: ['color', 'renk', 'colour'],
        kasa_tipi: ['body_type', 'kasa_tipi', 'kasa tipi'],
        kapi_sayisi: ['doors', 'kapi_sayisi', 'kapı sayısı'],
        durum: ['condition', 'durum', 'durumu'],
        kimden: ['from_who', 'kimden'],
        sahip_sayisi: ['owner_count', 'sahip_sayisi', 'sahip sayısı'],
        kazasiz: ['accident_free', 'kazasiz', 'kazasız'],
        tramer_kaydi: ['tramer', 'tramer_kaydi', 'hasar_kaydi'],
        batarya_kapasitesi: ['battery', 'battery_capacity', 'batarya'],
        menzil: ['range', 'menzil'],
        metrekare: ['area', 'metrekare', 'net_metrekare', 'net_area'],
        oda_sayisi: ['oda_sayisi', 'rooms'],
        kat: ['kat', 'floor'],
        asansor: ['asansor', 'asansör', 'elevator'],
        balkon: ['balkon', 'balcony'],
        esyali: ['esyali', 'eşyalı', 'furnished']
    };

    const resolveValue = (name) => {
        const keys = [name, ...(aliases[name] || [])];
        for (const key of keys) {
            if (extra[key] !== undefined && extra[key] !== null) return extra[key];
        }
        return '';
    };

    const categorySpecificFields = document.getElementById('categorySpecificFields');
    if (categorySpecificFields) {
        const inputs = categorySpecificFields.querySelectorAll('input, select, textarea');
        inputs.forEach((input) => {
            const val = resolveValue(input.name);
            if (val === '') return;
            if (input.tagName === 'SELECT') {
                const option = Array.from(input.options).find(opt => opt.value.toLowerCase() === String(val).toLowerCase());
                if (option) input.value = option.value;
            } else {
                input.value = val;
            }
        });
    }

    // Prefill Technical Details from extra_fields
    if (extra && extra.technical_details) {
        try {
            const techs = Array.isArray(extra.technical_details) ? extra.technical_details : JSON.parse(extra.technical_details);
            techs.forEach(tech => {
                // Escape special characters in value for CSS selector
                // or easier: iterate all checkboxes and check value
                const cb = document.querySelector(`input.tech-checkbox-input[value="${tech}"]`);
                if (cb) cb.checked = true;
            });
        } catch (e) {
            console.warn('Technical details parse error', e);
        }
    }
}

// Display category info in banner
function displayCategoryInfo() {
    const categoryTitle = document.getElementById('categoryTitle');
    const categorySubtitle = document.getElementById('categorySubtitle');
    const categoryIcon = document.getElementById('categoryIcon');

    // Support both old and new formats
    let main, sub, detail;
    if (selectedCategory.path && Array.isArray(selectedCategory.path)) {
        // New format: { path: ['Real Estate', 'Residential', 'Residential for Sale'], ... }
        [main, sub, detail] = selectedCategory.path;
    } else if (selectedCategory.main) {
        // Old format: { main, sub, detail }
        main = selectedCategory.main;
        sub = selectedCategory.sub;
        detail = selectedCategory.detail;
    } else {
        main = 'category_id';
        sub = 'Not found';
        detail = 'Select';
    }

    categoryTitle.textContent = detail;
    categorySubtitle.textContent = `${main} > ${sub} > ${detail}`;

    // Set icon based on category (include both Turkish and English keys for compatibility)
    const iconMap = {
        'Real Estate': 'fa-home',
        'Vehicles': 'fa-car',
        'Parts & Accessories': 'fa-cog',
        'Technology': 'fa-microchip',
        'Home & Decor': 'fa-couch',
        'Pets': 'fa-paw',
        'Second Hand': 'fa-recycle',
        'Construction Equipment': 'fa-tools',
        'Service Providers': 'fa-wrench',
        'Private Lessons': 'fa-book',
        'Job Listings': 'fa-briefcase',
        'Animals': 'fa-cat',
        'Assistant Services': 'fa-handshake'
    };

    const iconClass = iconMap[main] || 'fa-box';
    categoryIcon.className = `fas ${iconClass}`;
}

// Render category-specific fields
function renderCategorySpecificFields() {
    const container = document.getElementById('categorySpecificFields');
    if (!container) {
        console.error('❌ categorySpecificFields container not found!');
        return;
    }

    container.innerHTML = '';

    if (!selectedCategory) {
        console.warn('⚠️ No category selected, defaulting to Cars');
        selectedCategory = {
            path: ['Vehicles', 'Cars', 'Cars'],
            selectedId: 102,
            selectedCategory: { name: 'Cars', level: 2 }
        };
    }

    // Extract detail from both old and new formats
    let detail;
    if (selectedCategory.path && Array.isArray(selectedCategory.path)) {
        detail = selectedCategory.path[selectedCategory.path.length - 1];
    } else if (selectedCategory.detail) {
        detail = selectedCategory.detail;
    } else {
        detail = 'Otomobil'; // Fallback
    }

    console.log('📋 Selected category detail:', detail);

    // Get inherited fields using the tree logic
    let fields = [];
    const cat = getCategoryByName(detail);
    if (cat) {
        fields = getInheritedFields(cat);
    } else {
        // Fallback for string-based detail if object not found
        fields = getInheritedFields(detail);
    }
    
    console.log(`📋 Inherited fields found for "${detail}":`, fields.length);

    // Enrichment: Ana kategoriye göre detaylı alanları ekle
    const main = selectedCategory.path ? selectedCategory.path[0] : (selectedCategory.main || '');
    const mainCat = (main || '').toLowerCase();
    const detailCat = (detail || '').toLowerCase();
    // Normalize by removing spaces for comparisons (handles "Real Estate", "RealEstate" and "Emlak")
    const normalizedMain = mainCat.replace(/\s+/g, '');

    if (normalizedMain === 'emlak' || normalizedMain === 'realestate') {
        // PREPEND Common fields (Takas, İlan Sahibi) so they appear at the top
        const commonFields = (enrichmentTemplates.RealEstateCommon && enrichmentTemplates.RealEstateCommon.fields) ? enrichmentTemplates.RealEstateCommon.fields : [];
        fields = [...commonFields, ...fields.filter(f => !commonFields.some(cf => cf.name === f.name))];
        
        if (detailCat.includes('arsa')) {
            fields = mergeFieldsWithTemplates(fields, enrichmentTemplates.arsaCommon);
        }
        if (detailCat.includes('işyeri') || detailCat.includes('isyeri')) {
            fields = mergeFieldsWithTemplates(fields, enrichmentTemplates.isyeriCommon);
        }
    }

    if (mainCat === 'vasıta' || mainCat === 'vasita') {
        // Elektrikli ise electricExtras ekle
        const isElectric = detailCat.includes('elektrikli') || detailCat.includes('hybrid') || detailCat.includes('ev');
        if (isElectric) {
            fields = mergeFieldsWithTemplates(fields, enrichmentTemplates.electricExtras);
        } else {
            fields = mergeFieldsWithTemplates(fields, enrichmentTemplates.otomobilExtras);
        }
    }

    if (mainCat === 'elektronik') {
        if (detailCat.includes('telefon') || detailCat.includes('cep') || detailCat.includes('smartphone')) {
            fields = mergeFieldsWithTemplates(fields, enrichmentTemplates.elektronikTelefon);
        } else if (detailCat.includes('laptop') || detailCat.includes('bilgisayar') || detailCat.includes('notebook')) {
            fields = mergeFieldsWithTemplates(fields, enrichmentTemplates.elektronikLaptop);
        } else if (detailCat.includes('tv') || detailCat.includes('televizyon')) {
            fields = mergeFieldsWithTemplates(fields, enrichmentTemplates.elektronikTV);
        }
    }

    if (mainCat.includes('ev') || mainCat.includes('yaşam') || mainCat.includes('yaşam')) {
        if (detailCat.includes('beyaz') || detailCat.includes('eşya') || detailCat.includes('esya')) {
            fields = mergeFieldsWithTemplates(fields, enrichmentTemplates.beyazEsya);
        } else if (detailCat.includes('mobilya') || detailCat.includes('koltuk') || detailCat.includes('yatak') || detailCat.includes('dolap')) {
            fields = mergeFieldsWithTemplates(fields, enrichmentTemplates.mobilya);
        }
    }

    // If still empty, no product feature fields could be loaded
    if (fields.length === 0) {
        console.error('❌ Product feature fields could not be loaded');
        container.innerHTML = '<p style="color: #ef4444; padding: 1rem;">Product feature fields could not be loaded. Please return to the category selection and try again.</p>';
        return;
    }

    console.log('✅ Toplam', fields.length, 'alan render ediliyor');

    // Define which fields should be optional for Cars category
    const optionalFieldNames = new Set(['garanti', 'import', 'takas']);

    fields.forEach((field, idx) => {
        // Add divider before optional fields section (after required fields)
        if (idx > 0 && fields[idx - 1].required !== false && field.required === false) {
            // First optional field - add divider
            const divider = document.createElement('div');
            divider.className = 'field-section-divider';
            container.appendChild(divider);

            const optionalLabel = document.createElement('div');
            optionalLabel.className = 'field-section-label';
            optionalLabel.textContent = 'Optional Fields';
            container.appendChild(optionalLabel);
        }

        // Kilometre alanı için özel render
        if (field.name === 'kilometre') {
            const group = document.createElement('div');
            group.className = 'form-group';

            const label = document.createElement('label');
            label.className = 'form-label';
            label.innerHTML = `
                <span>${field.label}</span>
                ${field.required ? '<span class="required">*</span>' : ''}
            `;
            group.appendChild(label);

            // Wrapper div for input + select side by side
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; gap: 0.75rem; align-items: center;';

            // Input field
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-input';
            input.name = 'kilometre';
            input.placeholder = field.placeholder || '0';
            input.required = field.required;
            if (field.min !== undefined) input.min = field.min;
            input.style.cssText = 'flex: 1;';
            wrapper.appendChild(input);

            // Select for KM/MİL
            const select = document.createElement('select');
            select.className = 'form-input';
            select.name = 'kilometre_unit';
            select.style.cssText = 'flex: 0 0 100px;';

            const kmOption = document.createElement('option');
            kmOption.value = 'km';
            kmOption.textContent = 'KM';
            select.appendChild(kmOption);

            const milOption = document.createElement('option');
            milOption.value = 'mil';
            milOption.textContent = 'MILES';
            select.appendChild(milOption);

            wrapper.appendChild(select);
            group.appendChild(wrapper);
            container.appendChild(group);
            console.log(`  ✓ Field ${idx + 1}: ${field.label} (KM/MILES option)`);
            return; // Bu alan için foreach'i bitir
        }

        const group = document.createElement('div');
        group.className = 'form-group';

        const label = document.createElement('label');
        label.className = 'form-label';
        label.innerHTML = `
            <span>${field.label}</span>
            ${field.required ? '<span class="required">*</span>' : ''}
        `;

        let input;

        if (field.type === 'select') {
            input = document.createElement('select');
            input.className = 'form-input';
            input.name = field.name;
            input.required = field.required;

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = `Select ${field.label}...`;
            input.appendChild(placeholder);

            field.options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option;
                input.appendChild(opt);
            });
        } else {
            input = document.createElement('input');
            input.type = field.type;
            input.className = 'form-input';
            input.name = field.name;
            input.placeholder = field.placeholder || '';
            input.required = field.required;

            if (field.min !== undefined) input.min = field.min;
            if (field.max !== undefined) input.max = field.max;
        }

        group.appendChild(label);
        group.appendChild(input);
        container.appendChild(group);
        console.log(`  ✓ Field ${idx + 1}: ${field.label}`);
    });
}

// Render Technical Details (Step 3) - Only for Vehicles or if configured
function renderTechDetails() {
    const container = document.getElementById('techDetailsContainer');
    if (!container) return;

    container.innerHTML = '';

    // 1. Check for dynamic config in category
    const config = selectedCategory.extra_fields_config || {};
    const dynamicTechDetails = config.tech_details;

    // 2. Check if category is Vehicle for fallback
    const path = selectedCategory.path || [];
    const main = path[0] || selectedCategory.main || '';
    const isVehicle = main.toLowerCase().includes('vasıta') || main.toLowerCase().includes('vehicles') || main.toLowerCase().includes('otomobil') || main.toLowerCase().includes('cars');

    let techDetailsToRender = null;
    if (dynamicTechDetails && Object.keys(dynamicTechDetails).length > 0) {
        techDetailsToRender = dynamicTechDetails;
    } else if (isVehicle) {
        techDetailsToRender = carTechDetails;
    }

    if (!techDetailsToRender) {
        container.innerHTML = '<p style="padding: 1rem; color: #64748b;">No technical details selection for this category. You can proceed.</p>';
        return;
    }

    // Render groups
    Object.entries(techDetailsToRender).forEach(([groupName, features], index) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'tech-group';

        const header = document.createElement('div');
        header.className = 'tech-group-header';
        header.innerHTML = `
            <span>${groupName}</span>
            <i class="fas fa-chevron-down"></i>
        `;
        header.onclick = () => {
            groupEl.classList.toggle('active');
        };

        const content = document.createElement('div');
        content.className = 'tech-group-content';

        features.forEach(feature => {
            const label = document.createElement('label');
            label.className = 'tech-checkbox-label';
            label.innerHTML = `
                <span>${feature}</span>
                <input type="checkbox" name="technical_details" value="${feature}" class="tech-checkbox-input">
            `;
            content.appendChild(label);
        });

        groupEl.appendChild(header);
        groupEl.appendChild(content);
        container.appendChild(groupEl);
    });
}

// Setup form listeners
function setupFormListeners() {
    // Character count for description
    const descriptionEditor = document.getElementById('descriptionEditor');
    const descriptionInputHidden = document.getElementById('description');
    const charCountEl = document.getElementById('charCount');
    if (descriptionEditor && charCountEl) {
        const updateCharCount = () => {
            // use plain text length (no html)
            const text = descriptionEditor.textContent || '';
            const len = text.trim().length;
            charCountEl.textContent = len;
            // keep hidden input in sync (store HTML)
            if (descriptionInputHidden) descriptionInputHidden.value = descriptionEditor.innerHTML || '';
        };

        // Toolbar actions
        const toolbar = document.getElementById('rteToolbar');
        if (toolbar) {
            toolbar.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-cmd]');
                if (!btn) return;
                const cmd = btn.getAttribute('data-cmd');
                if (cmd === 'createLink') {
                    const url = prompt('Please enter a URL (e.g., https://example.com):', 'https://');
                    if (url) document.execCommand('createLink', false, url);
                } else if (cmd === 'removeFormat') {
                    document.execCommand('removeFormat', false, null);
                } else {
                    document.execCommand(cmd, false, null);
                }
                descriptionEditor.focus();
                updateCharCount();
            });
        }

        // Update on input and paste
        descriptionEditor.addEventListener('input', updateCharCount);
        descriptionEditor.addEventListener('paste', (e) => {
            // Plain text paste to avoid unwanted styles
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            document.execCommand('insertText', false, text);
            updateCharCount();
        });

        updateCharCount(); // initialize on load
    }

    setupContactSection();

    // Photo upload - NOW HANDLED BY photo-upload.js
    // Removed duplicate photo upload code to prevent conflicts
    // See js/photo-upload.js for the active implementation

    // ── Fiyat biçimlendirme (max 9 rakam, nokta ayraçlı: 111.111.111) ──
    const priceDisplay = document.getElementById('price-display');
    const priceHidden  = document.getElementById('price');
    if (priceDisplay && priceHidden) {
        priceDisplay.addEventListener('input', () => {
            // Sadece rakam bırak
            let digits = priceDisplay.value.replace(/\D/g, '');
            // Max 9 rakam
            if (digits.length > 9) digits = digits.slice(0, 9);
            // Nokta ayraçlı formatlama (türk formatı: 1.000.000)
            const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            priceDisplay.value = formatted;
            // Hidden alana ham sayıyı yaz
            priceHidden.value = digits;
        });

        // Live preview için price güncellemesi
        priceDisplay.addEventListener('input', () => {
            const previewPrice = document.getElementById('previewPrice');
            if (previewPrice) {
                const digits = priceHidden.value || '0';
                const formatted = parseInt(digits || '0').toLocaleString('en-GB');
                previewPrice.textContent = `€${formatted}`;
            }
        });
    }
} // end setupFormListeners

async function setupContactSection() {
    const contactNameInput = document.getElementById('contactName');
    const contactPhoneDisplay = document.getElementById('contactPhoneDisplay');
    const prefRadios = document.querySelectorAll('input[name="contactPreference"]');
    const phoneHint = document.getElementById('contactHintPhone');
    const messageHint = document.getElementById('contactHintMessage');
    const contactCard = document.getElementById('contactCard');

    // Load user info from profile
    try {
        const { supabase } = await import('./supabase.js');
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            // Profil bilgilerini çek
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('full_name, phone')
                .eq('id', user.id)
                .single();

            if (profile && !error) {
                if (contactNameInput) {
                    contactNameInput.value = profile.full_name || user.email || 'User';
                }
                if (contactPhoneDisplay) {
                    contactPhoneDisplay.value = profile.phone || 'Phone not provided';
                }
            } else {
                // If no profile, use email
                if (contactNameInput) {
                    contactNameInput.value = user.email || 'User';
                }
            }
        }
    } catch (error) {
        console.warn('⚠️ Profile info could not be loaded:', error);
    }

    // Radio durumlarına göre görünüm
    if (prefRadios.length && phoneHint && messageHint && contactCard) {
        const updatePreference = () => {
            const selected = document.querySelector('input[name="contactPreference"]:checked');
            const isMessageOnly = selected && selected.value === 'message';
            phoneHint.style.display = isMessageOnly ? 'none' : 'block';
            messageHint.style.display = isMessageOnly ? 'block' : 'none';
            contactCard.classList.toggle('message-only', isMessageOnly);
        };

        prefRadios.forEach(r => r.addEventListener('change', updatePreference));
        updatePreference();
    }
}

// Navigate to next step (REMOVED - Single Page)
// function nextStep() { }

// Navigate to previous step (REMOVED - Single Page)  
// function previousStep() { }


// Update Progress Bar (Visual Only - Auto-updates on scroll)
// Wizard: Step management (simple)
import { listingLimiter } from './rate-limiter.js';
let currentStepIndex = 1;
function initWizard() {
    const steps = Array.from(document.querySelectorAll('.form-step'));
    if (!steps.length) return;
    // Show first step
    steps.forEach(s => s.classList.remove('active'));
    steps[0].classList.add('active');
    currentStepIndex = 1;
    updateStepUI();

    // Bind buttons
    const next = document.getElementById('nextStep');
    const prev = document.getElementById('prevStep');
    const stickyNext = document.getElementById('stickyNext');
    const stickyPrev = document.getElementById('stickyPrev');

    function goNext() {
        const steps = Array.from(document.querySelectorAll('.form-step'));
        const total = steps.length;
        if (currentStepIndex < total) {
            // Validate current step before proceeding
            const currentStepEl = steps[currentStepIndex - 1];
            if (!validateForm(currentStepEl)) {
                console.warn('Step validation failed. Please fill all required fields.');
                return;
            }

            currentStepIndex++;
            showStep(currentStepIndex);
            scrollToFormTop();
        }
    }
    function goPrev() {
        if (currentStepIndex > 1) {
            currentStepIndex--;
            showStep(currentStepIndex);
            scrollToFormTop();
        }
    }

    if (next) next.addEventListener('click', goNext);
    if (prev) prev.addEventListener('click', goPrev);
    if (stickyNext) stickyNext.addEventListener('click', goNext);
    if (stickyPrev) stickyPrev.addEventListener('click', goPrev);

    // Initialize progress bar for steps
    updateStepUI();
}

function showStep(index) {
    const steps = Array.from(document.querySelectorAll('.form-step'));
    if (!steps.length) return;
    const total = steps.length;
    steps.forEach((s, i) => {
        s.classList.toggle('active', i === index - 1);
    });
    currentStepIndex = Math.min(Math.max(1, index), total);
    updateStepUI();
}

// Scroll helper: bring the form container to the top of the viewport
function scrollToFormTop() {
    try {
        const el = document.querySelector('.form-container') || document.getElementById('listingForm') || document.querySelector('main');
        if (!el) return;
        // Use smooth behavior when available
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // As a backup, ensure window is aligned exactly at element top after animation
        setTimeout(() => {
            const rect = el.getBoundingClientRect();
            const top = window.scrollY + rect.top;
            window.scrollTo({ top: Math.max(0, top - 8), behavior: 'instant' in window ? 'instant' : 'auto' });
        }, 350);
    } catch (e) {
        console.warn('scrollToFormTop hata:', e);
    }
}

function updateStepUI() {
    const steps = Array.from(document.querySelectorAll('.form-step'));
    const total = steps.length;
    const progressFill = document.getElementById('progressFill');
    if (progressFill && total > 0) {
        // Custom progress mapping: after leaving page 1 -> 30%, after leaving page 2 -> 80%
        let pct;
        if (currentStepIndex === 2) {
            pct = 30;
        } else if (currentStepIndex === 3) {
            pct = 80;
        } else {
            pct = Math.round((currentStepIndex - 1) / (total - 1 || 1) * 100);
        }
        progressFill.style.width = `${pct}%`;
    }

    // Show/hide publish button
    const publish = document.getElementById('publishBtn');
    const stickyNext = document.getElementById('stickyNext');
    if (publish) publish.style.display = (currentStepIndex === total) ? 'inline-flex' : 'none';
    if (stickyNext) stickyNext.style.display = (currentStepIndex === total) ? 'none' : 'inline-flex';
}

// Initialize wizard after DOM ready
document.addEventListener('DOMContentLoaded', initWizard);

function updateProgress() {
    const form = document.getElementById('listingForm');
    const progressFill = document.getElementById('progressFill');

    if (!form || !progressFill) {
        console.warn('⚠️ Progress bar elements not found; skipping progress display.');
        return;
    }

    const update = () => {
        const docHeight = Math.max(form.offsetHeight - window.innerHeight, 1);
        const scrollPercent = Math.min(Math.max(window.scrollY / docHeight, 0), 1);
        progressFill.style.width = `${(scrollPercent * 100).toFixed(2)}%`;
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
}

// Basic form validation wrapper used by the submit handler and step navigation.
// Uses native HTML5 validity where possible and reports issues to the user.
function validateForm(container = null) {
    try {
        const form = document.getElementById('listingForm');
        if (!form) return true;

        // If no container provided, validate the whole form
        const target = container || form;
        
        // Find all inputs in the target container
        const inputs = Array.from(target.querySelectorAll('input, select, textarea:not(.visually-hidden)'));
        
        let firstInvalid = null;
        let isValid = true;

        for (const input of inputs) {
            const group = input.closest('.form-group');
            // Check HTML5 validity
            if (input.checkValidity && !input.checkValidity()) {
                isValid = false;
                if (!firstInvalid) firstInvalid = input;
                
                // Add error class for visual feedback (consistent with CSS .error)
                input.classList.add('error');
                if (group) group.classList.add('has-error');
            } else {
                input.classList.remove('error');
                if (group) group.classList.remove('has-error');
            }
        }

        // Custom validation for Rich Text Editor (Description)
        const descriptionEditor = document.getElementById('descriptionEditor');
        const descriptionGroup = descriptionEditor ? descriptionEditor.closest('.form-group') : null;
        if (descriptionEditor && (target.contains(descriptionEditor) || target === form)) {
            const text = descriptionEditor.textContent || '';
            const strippedText = text.trim();
            if (strippedText.length < 5) {
                isValid = false;
                descriptionEditor.classList.add('error');
                if (descriptionGroup) descriptionGroup.classList.add('has-error');
                if (!firstInvalid) firstInvalid = descriptionEditor;
            } else {
                descriptionEditor.classList.remove('error');
                if (descriptionGroup) descriptionGroup.classList.remove('has-error');
            }
        }

        if (!isValid && firstInvalid) {
            // Scroll to the first invalid element
            const offset = 120; // sticky header offset
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = firstInvalid.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            // Focus and show native popover
            setTimeout(() => {
                if (firstInvalid.focus) firstInvalid.focus();
                if (firstInvalid.reportValidity) firstInvalid.reportValidity();
            }, 500);

            return false;
        }

        return true;
    } catch (e) {
        console.warn('validateForm hata:', e);
        return true;
    }
}

// Handle form submit
async function handleFormSubmit(event) {
    event.preventDefault();

    // 🟢 YENİ: Rate Limit Kontrolü
    const { supabase } = await import('./supabase.js');
    const { data: { user } } = await supabase.auth.getUser();

    if (user && listingLimiter.isLimited('user_' + user.id)) {
        const minutesRemaining = listingLimiter.getLockTimeRemaining('user_' + user.id);
        if (typeof showNotification === 'function') {
            showNotification(`Too many listings. Please wait ${minutesRemaining} minutes.`, 'warning');
        }
        return;
    }

    if (!validateForm()) {
        console.warn('Form validation failed.');
        return;
    }

    // Show loading modal
    document.getElementById('loadingModal').style.display = 'flex';

    try {
        // Import API
        const { createListing } = await import('./api.js');

        // Get form data
        const formElement = document.getElementById('listingForm');
        // ensure rich editor content is copied to hidden `description` field
        const descriptionEditor = document.getElementById('descriptionEditor');
        const descriptionHidden = document.getElementById('description');
        if (descriptionEditor && descriptionHidden) {
            descriptionHidden.value = descriptionEditor.innerHTML || descriptionEditor.textContent || '';
        }

        const formData = new FormData(formElement);

        // Fotoğrafları base64'e çevir
        const photos = [];
        if (window.uploadedPhotos && window.uploadedPhotos.length > 0) {
            for (const photo of window.uploadedPhotos) {
                try {
                    const response = await fetch(photo.url);
                    const blob = await response.blob();
                    const reader = new FileReader();

                    await new Promise((resolve, reject) => {
                        reader.onload = () => {
                            photos.push({
                                name: photo.name,
                                data: reader.result // base64 string
                            });
                            resolve();
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (error) {
                    console.warn('⚠️ Error processing photo:', error);
                }
            }
        }

        // Extra fields (kategori özel alanlar)
        const extraFields = {};
        const categorySpecificFields = document.getElementById('categorySpecificFields');
        if (categorySpecificFields) {
            const inputs = categorySpecificFields.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                extraFields[input.name] = input.value;
            });
        }

        // Collect Technical Details (Step 3)
        const techDetails = [];
        const techCheckboxes = document.querySelectorAll('input[name="technical_details"]:checked');
        techCheckboxes.forEach(cb => {
            techDetails.push(cb.value);
        });
        if (techDetails.length > 0) {
            extraFields['technical_details'] = techDetails;
        }

        // Load user info from profile (inputs are disabled)
        const { supabase } = await import('./supabase.js');
        const { data: { user } } = await supabase.auth.getUser();
        let contactName = 'User';
        let contactPhone = '';

        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, phone')
                .eq('id', user.id)
                .single();

            contactName = profile?.full_name || user.email || 'User';
            contactPhone = profile?.phone || '';
        }

        // 🟢 YENİ: Rate Limit Kaydet
        if (user) listingLimiter.recordAttempt('user_' + user.id);

        // Listing data object
        // Save category as slug (if possible) so homepage filtering by slug works.
        let categorySlug = 'genel';
        try {
            if (selectedCategory) {
                // New format: selectedId or selectedCategory may contain id
                const selId = selectedCategory.selectedId || (selectedCategory.selectedCategory && selectedCategory.selectedCategory.id);
                if (selId) {
                    const catObj = getCategoryById(selId);
                    if (catObj && catObj.slug) categorySlug = catObj.slug;
                } else if (selectedCategory.selectedCategory && selectedCategory.selectedCategory.slug) {
                    categorySlug = selectedCategory.selectedCategory.slug;
                } else if (selectedCategory.detail || selectedCategory.sub) {
                    const nameCandidate = String(selectedCategory.detail || selectedCategory.sub).toLowerCase().replace(/\s+/g, '-');
                    const catObj = getCategoryBySlug(nameCandidate);
                    if (catObj && catObj.slug) categorySlug = catObj.slug;
                    else categorySlug = nameCandidate;
                }
            }
        } catch (e) {
            console.warn('Kategori slug çözümleme hatası', e);
        }

        const listingData = {
            title: formData.get('title'),
            description: formData.get('description'),
            price: formData.get('price'),
            currency: formData.get('currency') || 'EUR',
            category: categorySlug,
            location: `${formData.get('city')}, ${formData.get('district')}`,
            photos: photos,
            extraFields: extraFields,
            contactName: contactName,
            contactPhone: contactPhone,
            contactPreference: formData.get('contactPreference') || 'phone'
        };

        console.log('📤 Form Kategori:', listingData.category);
        console.log('📤 Extra Fields Kaydı:', listingData.extraFields);
        console.log('📤 İlan gönderiliyor:', listingData);

        // Create listing in Supabase
        const result = await createListing(listingData);

        console.log('✅ Listing created successfully:', result);

        // Show success modal
        document.getElementById('loadingModal').style.display = 'none';

        // Prefer the atomic `listing_number` returned by the DB insert.
        // This requires running the migration that adds `listing_number` (see sql/001-add-listing-number.sql).
        try {
            const listingNumberFromDb = result && (result.listing_number || result.listing_number === 0) ? result.listing_number : null;
            if (listingNumberFromDb) {
                document.getElementById('adId').textContent = String(listingNumberFromDb);
            } else {
                // If DB doesn't provide listing_number yet (migration not run), fall back to safe local increment.
                const key = 'local_last_listing_number';
                const last = parseInt(localStorage.getItem(key) || '0', 10) || 0;
                const next = last + 1;
                localStorage.setItem(key, String(next));
                document.getElementById('adId').textContent = String(next);
            }
        } catch (e) {
            const key = 'local_last_listing_number';
            const last = parseInt(localStorage.getItem(key) || '0', 10) || 0;
            const next = last + 1;
            localStorage.setItem(key, String(next));
            document.getElementById('adId').textContent = String(next);
        }

        document.getElementById('successModal').style.display = 'flex';

    } catch (error) {
        console.error('❌ Error:', error);
        document.getElementById('loadingModal').style.display = 'none';
        alert('An error occurred while publishing the listing: ' + error.message);
    }
}

// Change category
function changeCategory() {
    const form = document.getElementById('listingForm');
    const formData = new FormData(form);
    const hasData = Array.from(formData.entries()).some(([key, value]) => value.toString().trim());

    if (hasData && !editingListing) {
        // Modal göster
        const modal = document.createElement('div');
        modal.style.cssText = `
               position: fixed;
               top: 0;
               left: 0;
               right: 0;
               bottom: 0;
               background: rgba(0,0,0,0.5);
               display: flex;
               align-items: center;
               justify-content: center;
               z-index: 10000;
           `;

        modal.innerHTML = `
               <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                   <h3 style="margin-bottom: 0.75rem; color: #0f172a; display: flex; align-items: center; gap: 0.75rem;">
                       <i class="fas fa-exclamation-circle" style="color: #f59e0b; font-size: 1.25rem;"></i>
                       Change category?
                   </h3>
                   <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">
                       If you change the category, the values in the <strong>Product Features</strong> section will be cleared. Other information (title, description, price) will be preserved.
                   </p>
                   <div style="display: flex; gap: 0.75rem;">
                       <button id="changeCategoryConfirm" style="flex: 1; padding: 0.75rem; background: #f59e0b; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                           Yes, Change
                       </button>
                       <button id="changeCategoryCancel" style="flex: 1; padding: 0.75rem; background: #e2e8f0; color: #1e293b; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                           Cancel
                       </button>
                   </div>
               </div>
           `;

        document.body.appendChild(modal);

        document.getElementById('changeCategoryConfirm').addEventListener('click', () => {
            modal.remove();
            sessionStorage.removeItem('selectedCategory');
            window.location.href = 'ilan-ver.html';
        });

        document.getElementById('changeCategoryCancel').addEventListener('click', () => {
            modal.remove();
        });
    } else {
        sessionStorage.removeItem('selectedCategory');
        window.location.href = 'ilan-ver.html';
    }
}

// Redirect to home
function redirectHome() {
    window.location.href = 'index.html';
}

// Expose handlers for inline HTML attributes (module scope -> global)
window.handleFormSubmit = handleFormSubmit;
window.changeCategory = changeCategory;
window.redirectHome = redirectHome;



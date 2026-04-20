
import { supabase } from './supabase.js';
import { initializeCategories, getCategoryById, getCategoryByName } from './category-data.js';
import { checkFieldsForProfanity } from './profanity-filter.js';

let selectedCategory = null;
let currentStep = 1;
let existingPhotos = [];
let newPhotos = [];
let listingId = null;

// Car Tech Details (Same as mobile/add listing)
const carTechDetails = {
    'Security': ['ABS', 'AEB', 'BAS', 'Child Lock', 'Distronic', 'ESP / VSA', 'Night Vision System', 'Airbag (Driver)', 'Airbag (Passenger)', 'Immobilizer', 'Isofix', 'Blind Spot Warning System', 'Central Locking', 'Lane Tracking System', 'Hill Start Assist', 'Fatigue Detection System', 'Armored Vehicle'],
    'Interior': ['Adaptive Cruise Control', 'Keyless Entry & Start', 'Leather Seats', 'Electric Windows', 'Functional Steering Wheel', 'Rear View Camera', 'Head-up Display', 'Cruise Control', 'Power Steering', 'Heated Steering Wheel', 'Air Conditioning', 'Electric Seats', 'Memory Seats', 'Heated Seats', 'Ventilated Seats', 'Fabric Seats', 'Auto-Dimming Rearview Mirror', 'Front View Camera', 'Front Armrest', 'Cooled Glove Box', 'Start / Stop', 'Third Row Seats', 'Trip Computer'],
    'Exterior': ['Hands-Free Tailgate', 'Hardtop', 'Adaptive Headlights', 'Electric Mirrors', 'Heated Mirrors', 'Memory Mirrors', 'Rear Parking Sensor', 'Front Parking Sensor', 'Parking Assistant', 'Sunroof', 'Smart Tailgate', 'Panoramic Roof', 'Tow Hitch'],
    'Multimedia': ['Android Auto', 'Apple CarPlay', 'Bluetooth', 'USB / AUX', 'Navigation', 'Sound System', 'TV', 'Wireless Charging']
};

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    listingId = params.get('id');
    if (!listingId) {
        window.location.href = 'ilanlarim.html';
        return;
    }

    document.getElementById('listingId').value = listingId;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    await initializeCategories();
    await loadListingData();
    setupEventListeners();
    updateProgress();
});

async function loadListingData() {
    try {
        const { data: listing, error } = await supabase
            .from('listings')
            .select('*')
            .eq('id', listingId)
            .single();

        if (error || !listing) throw new Error('Listing not found');

        // Populate basic fields
        document.getElementById('title').value = listing.title;
        document.getElementById('descriptionEditor').innerHTML = listing.description || '';
        document.getElementById('description').value = listing.description || '';
        document.getElementById('price').value = listing.price;
        document.getElementById('price-display').value = parseInt(listing.price).toLocaleString('en-MT');
        document.getElementById('city').value = listing.location_city || '';

        existingPhotos = listing.photos || [];
        renderPhotoPreviews();

        // Get Category
        selectedCategory = getCategoryById(listing.category_id);
        if (selectedCategory) {
            displayCategoryInfo();
            renderCategorySpecificFields(listing.extra_fields || {});
            renderTechDetails(listing.extra_fields?.technical_details || []);
        }

        updateLivePreview();
    } catch (err) {
        console.error(err);
        alert('Could not load listing data.');
    }
}

function displayCategoryInfo() {
    const title = document.getElementById('categoryTitle');
    const subtitle = document.getElementById('categorySubtitle');
    const icon = document.getElementById('categoryIcon');

    title.textContent = selectedCategory.name;
    subtitle.textContent = selectedCategory.full_path || selectedCategory.name;
    
    const iconMap = { 'Vehicles': 'fa-car', 'Real Estate': 'fa-home', 'Technology': 'fa-laptop' };
    const mainCat = (selectedCategory.full_path || '').split(' > ')[0];
    icon.className = `fas ${iconMap[mainCat] || 'fa-tag'}`;
}

function renderCategorySpecificFields(existingData) {
    const container = document.getElementById('categorySpecificFields');
    container.innerHTML = '';

    // Logic to get inherited fields from category-data.js metadata
    const fields = getInheritedFields(selectedCategory);
    
    fields.forEach(field => {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.innerHTML = `<label class="form-label">${field.label} ${field.required ? '*' : ''}</label>`;

        let input;
        if (field.type === 'select') {
            input = document.createElement('select');
            input.className = 'form-input';
            field.options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (existingData[field.name] === opt) o.selected = true;
                input.appendChild(o);
            });
        } else {
            input = document.createElement('input');
            input.type = field.type;
            input.className = 'form-input';
            input.value = existingData[field.name] || '';
        }
        input.name = field.name;
        if (field.required) input.required = true;
        group.appendChild(input);
        container.appendChild(group);
    });
}

function getInheritedFields(cat) {
    let fields = [];
    let current = cat;
    while (current) {
        const config = typeof current.extra_fields_config === 'string' ? JSON.parse(current.extra_fields_config) : current.extra_fields_config;
        if (config?.fields) {
            config.fields.forEach(f => {
                if (!fields.find(existing => existing.name === f.name)) fields.push(f);
            });
        }
        current = current.parent_id ? getCategoryById(current.parent_id) : null;
    }
    return fields;
}

function renderTechDetails(selectedTech = []) {
    const container = document.getElementById('techDetailsContainer');
    if (!container) return;
    container.innerHTML = '';

    const mainCat = (selectedCategory.full_path || '').toLowerCase();
    if (!mainCat.includes('vehicle') && !mainCat.includes('car')) {
        document.querySelector('[data-step="3"]').style.display = 'none';
        return;
    }

    Object.entries(carTechDetails).forEach(([groupName, features]) => {
        const group = document.createElement('div');
        group.className = 'tech-group active';
        group.innerHTML = `<div class="tech-group-header"><span>${groupName}</span><i class="fas fa-chevron-down"></i></div>`;
        const content = document.createElement('div');
        content.className = 'tech-group-content';
        
        features.forEach(f => {
            const isChecked = selectedTech.includes(f);
            content.innerHTML += `
                <label class="tech-checkbox-label">
                    <span>${f}</span>
                    <input type="checkbox" name="technical_details" value="${f}" class="tech-checkbox-input" ${isChecked ? 'checked' : ''}>
                </label>
            `;
        });
        group.appendChild(content);
        container.appendChild(group);
    });
}

function renderPhotoPreviews() {
    const grid = document.getElementById('photoPreviewGrid');
    grid.innerHTML = '';

    existingPhotos.forEach((url, idx) => {
        grid.innerHTML += `
            <div class="preview-box">
                <img src="${url}" alt="Listing photo">
                <button type="button" class="remove-btn" onclick="removeExistingPhoto(${idx})"><i class="fas fa-times"></i></button>
            </div>
        `;
    });

    newPhotos.forEach((file, idx) => {
        const url = URL.createObjectURL(file);
        grid.innerHTML += `
            <div class="preview-box new">
                <img src="${url}" alt="New photo">
                <button type="button" class="remove-btn" onclick="removeNewPhoto(${idx})"><i class="fas fa-times"></i></button>
                <span class="new-badge">New</span>
            </div>
        `;
    });

    // Add empty boxes if less than 10
    const total = existingPhotos.length + newPhotos.length;
    for (let i = total; i < 10; i++) {
        grid.innerHTML += `<div class="preview-box empty"><i class="fas fa-plus"></i></div>`;
    }
}

window.removeExistingPhoto = (idx) => {
    existingPhotos.splice(idx, 1);
    renderPhotoPreviews();
    updateLivePreview();
};

window.removeNewPhoto = (idx) => {
    newPhotos.splice(idx, 1);
    renderPhotoPreviews();
    updateLivePreview();
};

function setupEventListeners() {
    document.getElementById('photoInput').addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (existingPhotos.length + newPhotos.length + files.length > 10) {
            alert('Max 10 photos allowed.');
            return;
        }
        newPhotos = [...newPhotos, ...files];
        renderPhotoPreviews();
        updateLivePreview();
    });

    document.getElementById('stickyNext').addEventListener('click', () => {
        if (validateStep(currentStep)) {
            currentStep++;
            showStep(currentStep);
            updateProgress();
        }
    });

    document.getElementById('stickyPrev').addEventListener('click', () => {
        currentStep--;
        showStep(currentStep);
        updateProgress();
    });

    document.getElementById('listingForm').addEventListener('submit', handleUpdate);

    // Live preview updates
    ['title', 'price-display', 'city'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateLivePreview);
    });
}

function validateStep(step) {
    const form = document.getElementById('listingForm');
    const stepEl = document.querySelector(`[data-step="${step}"]`);
    const inputs = stepEl.querySelectorAll('input[required], select[required], textarea[required]');
    
    let valid = true;
    inputs.forEach(input => {
        if (!input.value) {
            input.classList.add('error');
            valid = false;
        } else {
            input.classList.remove('error');
        }
    });

    if (step === 1 && existingPhotos.length === 0 && newPhotos.length === 0) {
        alert('At least one photo is required.');
        valid = false;
    }

    return valid;
}

function showStep(step) {
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    document.querySelector(`[data-step="${step}"]`).classList.add('active');
    
    document.getElementById('stickyPrev').style.display = step === 1 ? 'none' : 'block';
    
    const isLast = (step === 4);
    document.getElementById('stickyNext').style.display = isLast ? 'none' : 'block';
    document.getElementById('publishBtn').style.display = isLast ? 'block' : 'none';
}

function updateProgress() {
    const fill = document.getElementById('progressFill');
    fill.style.width = `${(currentStep / 4) * 100}%`;
}

function updateLivePreview() {
    document.getElementById('previewTitle').textContent = document.getElementById('title').value || 'Listing Title';
    document.getElementById('previewPrice').textContent = `€${document.getElementById('price-display').value || '0'}`;
    document.getElementById('previewLocation').textContent = document.getElementById('city').value || 'Location';
    
    const previewImg = document.getElementById('previewImage');
    if (newPhotos.length > 0) {
        previewImg.src = URL.createObjectURL(newPhotos[0]);
    } else if (existingPhotos.length > 0) {
        previewImg.src = existingPhotos[0];
    }
}

async function handleUpdate(e) {
    e.preventDefault();
    document.getElementById('loadingModal').style.display = 'flex';

    try {
        // Upload new photos
        const uploadedUrls = [];
        for (const file of newPhotos) {
            const fileName = `${Date.now()}_${file.name}`;
            const { data, error } = await supabase.storage.from('listing-photos').upload(`listings/${fileName}`, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('listing-photos').getPublicUrl(data.path);
            uploadedUrls.push(publicUrl);
        }

        const finalPhotos = [...existingPhotos, ...uploadedUrls];
        const description = document.getElementById('descriptionEditor').innerHTML;
        
        // Get extra fields
        const extraFields = {};
        const step2El = document.querySelector('[data-step="2"]');
        step2El.querySelectorAll('input, select').forEach(input => {
            extraFields[input.name] = input.value;
        });

        // Get tech details
        const techDetails = Array.from(document.querySelectorAll('input[name="technical_details"]:checked')).map(cb => cb.value);
        extraFields.technical_details = techDetails;

        const { error } = await supabase
            .from('listings')
            .update({
                title: document.getElementById('title').value,
                description: description,
                price: parseFloat(document.getElementById('price').value.replace(/\D/g, '') || 0),
                location_city: document.getElementById('city').value,
                photos: finalPhotos,
                extra_fields: extraFields,
                status: 'pending' // Re-verify updated listing
            })
            .eq('id', listingId);

        if (error) throw error;

        document.getElementById('loadingModal').style.display = 'none';
        document.getElementById('successModal').style.display = 'flex';
    } catch (err) {
        alert(err.message);
        document.getElementById('loadingModal').style.display = 'none';
    }
}

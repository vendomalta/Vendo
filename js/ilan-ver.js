// ==========================================
// CREATE LISTING PAGE - MILLER COLUMNS LOGIC
// ==========================================
import { categories, getRootCategories, getChildCategories, getCategoryById, getCategoryBySlug, getCategoryPath, initializeCategories } from './category-data.js';
import { supabase } from './supabase.js';

// State Management
let selectedMainId = null;
let selectedSubId = null;
let selectedDetailId = null;

// DOM Elements
const mainCategoriesEl = document.getElementById('mainCategories');
const subCategoriesEl = document.getElementById('subCategories');
const detailCategoriesEl = document.getElementById('detailCategories');
const column2 = document.getElementById('column2');
const column3 = document.getElementById('column3');
const breadcrumb = document.getElementById('breadcrumb');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Show loading state
    if (mainCategoriesEl) mainCategoriesEl.innerHTML = '<li class="loading-item"><i class="fas fa-spinner fa-spin"></i> Yükleniyor...</li>';

    await initializeCategories();
    renderMainCategories();
    setupMobileAccordion();
});

// Setup Mobile Accordion Behavior
function setupMobileAccordion() {
    if (window.innerWidth > 768) return;

    // Column 1 header click - expand column 1, collapse others
    const column1 = document.getElementById('column1');
    const column1Header = column1?.querySelector('.column-header');
    if (column1Header) {
        column1Header.addEventListener('click', () => {
            if (column1.classList.contains('collapsed')) {
                column1.classList.remove('collapsed');
                column1.classList.add('expanded');
                if (column2) {
                    column2.classList.add('collapsed');
                    column2.classList.remove('expanded');
                }
                if (column3) {
                    column3.classList.add('collapsed');
                    column3.classList.remove('expanded');
                }
            }
        });
    }

    // Column 2 header click - expand column 2, collapse others
    if (column2) {
        const column2Header = column2.querySelector('.column-header');
        if (column2Header) {
            column2Header.addEventListener('click', () => {
                if (column2.classList.contains('collapsed')) {
                    column2.classList.remove('collapsed');
                    column2.classList.add('expanded');
                    if (column1) {
                        column1.classList.add('collapsed');
                        column1.classList.remove('expanded');
                    }
                    if (column3) {
                        column3.classList.add('collapsed');
                        column3.classList.remove('expanded');
                    }
                }
            });
        }
    }

    // Column 3 header click - expand column 3, collapse others
    if (column3) {
        const column3Header = column3.querySelector('.column-header');
        if (column3Header) {
            column3Header.addEventListener('click', () => {
                if (column3.classList.contains('collapsed')) {
                    column3.classList.remove('collapsed');
                    column3.classList.add('expanded');
                    if (column1) {
                        column1.classList.add('collapsed');
                        column1.classList.remove('expanded');
                    }
                    if (column2) {
                        column2.classList.add('collapsed');
                        column2.classList.remove('expanded');
                    }
                }
            });
        }
    }
}

// Render Main Categories (Column 1)
function renderMainCategories() {
    if (!mainCategoriesEl) {
        console.error('mainCategories element not found!');
        return;
    }

    mainCategoriesEl.innerHTML = '';

    const mains = getRootCategories();
    mains.forEach(cat => {
        const li = createCategoryItem({
            id: cat.id,
            name: cat.name,
            icon: cat.icon,
            iconColor: cat.iconColor,
            onClick: () => handleMainCategoryClick(cat.id)
        });
        mainCategoriesEl.appendChild(li);
    });

    updateBreadcrumb();
}

// Handle Main Category Click
function handleMainCategoryClick(catId) {
    selectedMainId = catId;
    selectedSubId = null;
    selectedDetailId = null;

    // Update active states in column 1
    const items = mainCategoriesEl.querySelectorAll('.category-item');
    items.forEach(item => item.classList.remove('active'));
    const activeItem = Array.from(items).find(item => item.dataset.id == catId);
    if (activeItem) activeItem.classList.add('active');

    // Show column 2 and render subcategories
    if (column2) column2.style.display = 'flex';
    if (column3) column3.style.display = 'none';
    const mainCat = getCategoryById(catId);
    if (column2) {
        const col2Title = document.getElementById('column2Title');
        if (col2Title) col2Title.textContent = mainCat?.name || 'Subcategory';
    }
    renderSubCategories(catId);
    updateBreadcrumb();

    // Mobile: Collapse column 1, expand column 2
    if (window.innerWidth <= 768) {
        const column1 = document.getElementById('column1');
        if (column1) {
            column1.classList.add('collapsed');
            column1.classList.remove('expanded');
        }
        if (column2) {
            column2.classList.add('expanded');
            column2.classList.remove('collapsed');
        }
    }
}

// Render Subcategories (Column 2)
function renderSubCategories(mainId) {
    if (!subCategoriesEl) {
        console.error('subCategories element not found!');
        return;
    }

    subCategoriesEl.innerHTML = '';

    const subs = getChildCategories(mainId);
    subs.forEach(sub => {
        const li = createCategoryItem({
            id: sub.id,
            name: sub.name,
            icon: sub.icon,
            iconColor: sub.iconColor,
            onClick: () => handleSubCategoryClick(mainId, sub.id)
        });
        subCategoriesEl.appendChild(li);
    });
}

// Handle Subcategory Click
function handleSubCategoryClick(mainId, subId) {
    selectedSubId = subId;
    selectedDetailId = null;

    // Update active states in column 2
    const items = subCategoriesEl.querySelectorAll('.category-item');
    items.forEach(item => item.classList.remove('active'));
    const activeItem = Array.from(items).find(item => item.dataset.id == subId);
    if (activeItem) activeItem.classList.add('active');

    // Show column 3 and render details
    if (column3) column3.style.display = 'flex';
    const subCat = getCategoryById(subId);
    if (column3) {
        const col3Title = document.getElementById('column3Title');
        if (col3Title) col3Title.textContent = subCat?.name || 'Alt Kategori';
    }
    renderDetailCategories(subId);
    updateBreadcrumb();

    // Mobile: Collapse column 2, expand column 3
    if (window.innerWidth <= 768) {
        if (column2) {
            column2.classList.add('collapsed');
            column2.classList.remove('expanded');
        }
        if (column3) {
            column3.classList.add('expanded');
            column3.classList.remove('collapsed');
        }
    }
}

// Render Detail Categories (Column 3)
function renderDetailCategories(subId) {
    if (!detailCategoriesEl) {
        console.error('detailCategories element not found!');
        return;
    }

    detailCategoriesEl.innerHTML = '';

    const details = getChildCategories(subId);
    if (details.length === 0) {
        // No further children - this is the end, allow selection
        const subCat = getCategoryById(subId);
        const li = document.createElement('li');
        li.className = 'category-item active';
        li.innerHTML = `
            <div class="category-icon" style="background: ${subCat.iconColor}15">
                <i class="fas ${subCat.icon}" style="color: ${subCat.iconColor}"></i>
            </div>
            <div class="category-text">
                <span class="category-name">${subCat.name}</span>
            </div>
        `;
        li.addEventListener('click', () => handleDetailClick(subId));
        detailCategoriesEl.appendChild(li);
        return;
    }

    details.forEach(detail => {
        const li = createCategoryItem({
            id: detail.id,
            name: detail.name,
            icon: detail.icon,
            iconColor: detail.iconColor,
            onClick: () => handleDetailClick(detail.id)
        });
        detailCategoriesEl.appendChild(li);
    });
}

// Handle Detail Click (Final Selection)
async function handleDetailClick(catId) {
    // Check session before proceeding
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        console.warn('User not logged in, redirecting to login...');
        // Store selected category to possibly resume (already done by original logic if we let it run)
        // But for clarity, we redirect to login with the target page as param
        window.location.href = 'login.html?redirect=ilan-ver-form.html';
        return;
    }

    selectedDetailId = catId;
    updateBreadcrumb();

    // Get full category path
    const path = getCategoryPath(catId);
    const categoryPath = {
        path: path.map(c => c.name),
        selectedId: catId,
        selectedCategory: getCategoryById(catId)
    };

    console.log('Category selected:', categoryPath);

    // Store in sessionStorage
    sessionStorage.setItem('selectedCategory', JSON.stringify(categoryPath));
    sessionStorage.setItem('selectedCategoryId', catId.toString());

    console.log('Saved to sessionStorage, redirecting...');

    // Redirect to form page
    setTimeout(() => {
        console.log('Redirecting to form page: ilan-ver-form.html');
        window.location.href = 'ilan-ver-form.html';
    }, 200);
}

// Create Category Item Element
function createCategoryItem({ id, name, icon, iconColor, onClick }) {
    const li = document.createElement('li');
    li.className = 'category-item';
    li.dataset.id = id;
    li.addEventListener('click', onClick);

    const iconDiv = document.createElement('div');
    iconDiv.className = 'category-icon';
    iconDiv.style.background = `${iconColor}15`;
    iconDiv.innerHTML = `<i class="fas ${icon}" style="color: ${iconColor}"></i>`;

    const textDiv = document.createElement('div');
    textDiv.className = 'category-text';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-name';
    nameSpan.textContent = name;
    textDiv.appendChild(nameSpan);

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'category-arrow';
    arrowSpan.innerHTML = '<i class="fas fa-chevron-right"></i>';

    li.appendChild(iconDiv);
    li.appendChild(textDiv);
    li.appendChild(arrowSpan);

    return li;
}

// Update Breadcrumb
function updateBreadcrumb() {
    if (!breadcrumb) return;

    breadcrumb.innerHTML = '';
    breadcrumb.style.display = 'none';

    const items = [];

    if (selectedMainId) {
        const main = getCategoryById(selectedMainId);
        if (main) items.push(main.name);
    }

    if (selectedSubId) {
        const sub = getCategoryById(selectedSubId);
        if (sub) items.push(sub.name);
    }

    if (selectedDetailId) {
        const detail = getCategoryById(selectedDetailId);
        if (detail) items.push(detail.name);
    }

    if (items.length === 0) {
        return; // Don't show breadcrumb if nothing selected
    }

    breadcrumb.style.display = 'block';
    items.forEach((item, index) => {
        const span = document.createElement('span');
        span.className = 'breadcrumb-item';
        if (index === items.length - 1) {
            span.classList.add('active');
        }
        span.textContent = item;
        breadcrumb.appendChild(span);

        if (index < items.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'breadcrumb-separator';
            sep.textContent = ' > ';
            breadcrumb.appendChild(sep);
        }
    });
}

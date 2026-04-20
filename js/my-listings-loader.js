// İlanlarım Sayfası Loader - Infinite Scroll (Lazy Loading) Sistemi
import { getMyListings, deleteListing, updateListing } from './api.js';

// State Management
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let currentFilter = 'all';
let currentViewMode = localStorage.getItem('myListingsViewMode') || 'grid';
let hasMore = true;
const ITEMS_PER_PAGE = 10;

// DOM Elements
const container = document.querySelector('.ads-container');
const scrollTrigger = document.getElementById('infinite-scroll-trigger');
const infiniteLoader = document.getElementById('infinite-loader');
const listBtn = document.getElementById('list-view-btn');
const gridBtn = document.getElementById('grid-view-btn');
const mobileToggle = document.querySelector('.view-toggle-btn'); // For mobile header if exists

document.addEventListener('DOMContentLoaded', async () => {
    if (!container) return;

    // View mode initialize
    applyViewMode();
    
    // Initial load
    await initPage();
    
    // Setup Infinite Scroll
    setupInfiniteScroll();
    
    // Setup Filters
    initializeFilters();
    
    // Setup View Toggle
    initializeViewToggle();
    
    // Setup Stats
    await fetchAndSetStats();
});

/**
 * Görünüm modunu uygula (Grid / List)
 */
function applyViewMode() {
    if (!container) return;

    if (currentViewMode === 'list') {
        container.classList.add('list-view');
        container.classList.remove('grid-view');
        listBtn?.classList.add('active');
        gridBtn?.classList.remove('active');
        if (mobileToggle) mobileToggle.innerHTML = '<i class="fas fa-list"></i>';
    } else {
        container.classList.add('grid-view');
        container.classList.remove('list-view');
        gridBtn?.classList.add('active');
        listBtn?.classList.remove('active');
        if (mobileToggle) mobileToggle.innerHTML = '<i class="fas fa-th-large"></i>';
    }
}

/**
 * Görünüm değiştirme butonlarını ayarla
 */
function initializeViewToggle() {
    listBtn?.addEventListener('click', () => {
        currentViewMode = 'list';
        localStorage.setItem('myListingsViewMode', 'list');
        applyViewMode();
    });

    gridBtn?.addEventListener('click', () => {
        currentViewMode = 'grid';
        localStorage.setItem('myListingsViewMode', 'grid');
        applyViewMode();
    });

    mobileToggle?.addEventListener('click', () => {
        currentViewMode = currentViewMode === 'grid' ? 'list' : 'grid';
        localStorage.setItem('myListingsViewMode', currentViewMode);
        applyViewMode();
    });
}

/**
 * Sayfayı sıfırla ve ilk yüklemeyi yap
 */
async function initPage() {
    currentPage = 1;
    hasMore = true;
    container.innerHTML = '';
    await loadListings(true);
}

/**
 * İlanları yükle
 * @param {boolean} isInitial - İlk yükleme mi?
 */
async function loadListings(isInitial = false) {
    if (isLoading || !hasMore) return;

    isLoading = true;
    if (infiniteLoader) infiniteLoader.style.display = 'block';

    try {
        const response = await getMyListings({
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            status: currentFilter
        });

        const listings = response.data;
        totalPages = response.totalPages;
        
        if (listings.length === 0 && isInitial) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <h3 style="margin-top: 1rem;">Henüz bir ilanınız bulunmuyor</h3>
                    <p style="color: var(--text-muted); margin-top: 0.5rem;">
                        İlk ilanınızı oluşturun ve satışa başlayın!
                    </p>
                </div>
            `;
            hasMore = false;
        } else {
            const cardsHtml = listings.map(listing => createAdCard(listing)).join('');
            container.insertAdjacentHTML('beforeend', cardsHtml);
            
            attachActionListeners();
            
            // Sonraki sayfa kontrolü
            if (currentPage >= totalPages || listings.length < ITEMS_PER_PAGE) {
                hasMore = false;
            } else {
                currentPage++;
            }
        }

    } catch (error) {
        console.error('İlanlar yüklenirken hata oluştu:', error);
        if (isInitial) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger);"></i>
                    <p style="margin-top: 1rem; color: var(--text-muted);">İlanlar yüklenirken bir sorun oluştu</p>
                </div>
            `;
        }
    } finally {
        isLoading = false;
        if (infiniteLoader) infiniteLoader.style.display = 'none';
    }
}

/**
 * Intersection Observer setup
 */
function setupInfiniteScroll() {
    if (!scrollTrigger) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
            loadListings();
        }
    }, {
        rootMargin: '200px'
    });

    observer.observe(scrollTrigger);
}

/**
 * İstatistikleri ayrıca çek ve güncelle
 */
async function fetchAndSetStats() {
    try {
        const [activeRes, soldRes] = await Promise.all([
            getMyListings({ limit: 1, status: 'active' }),
            getMyListings({ limit: 1, status: 'sold' })
        ]);

        const activeCount = activeRes.totalCount;
        const soldCount = soldRes.totalCount;

        const activeStat = document.getElementById('active-listings-count');
        const soldStat = document.getElementById('sold-listings-count');
        if (activeStat) activeStat.textContent = activeCount;
        if (soldStat) soldStat.textContent = soldCount;

        document.querySelectorAll('.tab-btn').forEach(tab => {
            const filter = tab.dataset.filter;
            let count = 0;
            if (filter === 'all') {
                 count = activeCount + soldCount;
            } else if (filter === 'active') count = activeCount;
            else if (filter === 'sold') count = soldCount;
            
            const label = tab.textContent.split('(')[0].trim();
            tab.textContent = `${label} (${count})`;
        });
    } catch (err) {
        console.warn('İstatistikler güncellenemedi:', err);
    }
}

function initializeFilters() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            if (tab.classList.contains('active')) return;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            currentFilter = tab.dataset.filter;
            await initPage();
        });
    });
}

function normalizeId(id) {
    if (id === undefined || id === null) return null;
    const str = String(id).trim();
    if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') return null;
    return str;
}

function createAdCard(listing) {
    const normalizedId = normalizeId(listing?.id);
    if (!listing || !normalizedId) return '';
    
    const normalizedStatus = normalizeStatus(listing.status);
    const imageUrl = listing.photos && listing.photos.length > 0 
        ? listing.photos[0] 
        : 'https://via.placeholder.com/400x300/10b981/ffffff?text=No+Photo';

    const formattedPrice = new Intl.NumberFormat('tr-TR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(listing.price);
    const currency = listing.currency === 'TL' ? '₺' : '€';
    
    const statusBadge = getStatusBadge(normalizedStatus);
    const daysLeft = getDaysLeft(listing.expires_at);

    const actionButtons = `
        <button class="action-btn primary edit-btn" data-id="${normalizedId}" title="Düzenle">
            <i class="fas fa-edit"></i>
        </button>
        ${normalizedStatus === 'active' ? `
        <button class="action-btn success mark-sold-btn" data-id="${normalizedId}" title="Mark as Sold">
            <i class="fas fa-check-circle"></i> SOLD
        </button>
        ` : ''}
        <button class="action-btn danger delete-btn" data-id="${normalizedId}" title="Sil">
            <i class="fas fa-trash"></i>
        </button>
    `;

    return `
        <div class="ad-card" data-listing-id="${normalizedId}" data-status="${normalizedStatus}" data-href="ilan-detay.html?id=${normalizedId}">
            <div class="ad-image">
                <img src="${imageUrl}" alt="${escapeHtml(listing.title)}">
                ${statusBadge}
                <div class="ad-favorites-overlay">
                    <i class="fas fa-heart"></i> ${listing.favorites?.[0]?.count || 0}
                </div>
            </div>
            <div class="ad-content">
                <h3 class="ad-title">${escapeHtml(listing.title)}</h3>
                <p class="ad-price">${currency}${formattedPrice}</p>
                <div class="ad-divider"></div>
                <div class="ad-action-row">
                    ${actionButtons}
                </div>
            </div>
            <div class="ad-sidebar-actions">
                ${actionButtons}
            </div>
        </div>
    `;
}

function getStatusBadge(status) {
    const badges = {
        'active': '<div class="ad-badge active">Aktif</div>',
        'closed': '<div class="ad-badge inactive">Pasif</div>',
        'sold': '<div class="ad-badge sold">SOLD</div>',
        'expired': '<div class="ad-badge expired">Süresi Doldu</div>',
        'pending': '<div class="ad-badge pending">Onay Bekliyor</div>'
    };
    return badges[status] || '';
}

function getDaysLeft(expiresAt) {
    return ''; // Feature disabled
}

function attachActionListeners() {
    const container = document.querySelector('.ads-container');
    if (!container || container.dataset.actionsBound) return;
    container.dataset.actionsBound = 'true';

    container.addEventListener('click', async (e) => {
        const card = e.target.closest('.ad-card');
        if (!card) return;

        const actionBtn = e.target.closest('.action-btn');
        if (actionBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const listingId = actionBtn.dataset.id;
            if (actionBtn.classList.contains('edit-btn')) {
                window.location.href = `ilan-detay.html?id=${listingId}&mode=edit`;
            } else if (actionBtn.classList.contains('delete-btn')) {
                 const confirmed = await VendoConfirm('Bu ilanı silmek istediğinize emin misiniz?', 'İlanı Sil');
                 if (confirmed) {
                     try {
                         await deleteListing(listingId);
                         card.remove();
                         showToast('İlan başarıyla silindi', 'success');
                         fetchAndSetStats();
                     } catch (err) {
                         showToast('Hata: ' + err.message, 'error');
                     }
                 }
            } else if (actionBtn.classList.contains('mark-sold-btn')) {
                const confirmed = await VendoConfirm('Bu ürünü satıldı olarak işaretlemek istediğine emin misin?', 'Satıldı Olarak İşaretle');
                if (confirmed) {
                    try {
                        await updateListing(listingId, { status: 'sold' });
                        showToast('İlan satıldı olarak güncellendi', 'success');
                        await initPage(); // Full reload to update counts and filters
                        fetchAndSetStats();
                    } catch (err) {
                        showToast('Hata: ' + err.message, 'error');
                    }
                }
            } else if (actionBtn.classList.contains('pause-btn') || actionBtn.classList.contains('activate-btn')) {
                const targetStatus = actionBtn.classList.contains('pause-btn') ? 'closed' : 'active';
                try {
                    await updateListing(listingId, { status: targetStatus });
                    showToast(`İlan ${targetStatus === 'active' ? 'aktifleştirildi' : 'durduruldu'}`, 'success');
                    await initPage();
                    fetchAndSetStats();
                } catch (err) {
                    showToast('Hata: ' + err.message, 'error');
                }
            }
            return;
        }

        const href = card.dataset.href;
        if (href) window.location.href = href;
    });
}

function formatDate(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('tr-TR');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizeStatus(status) {
    if (!status) return 'active';
    if (status === 'inactive' || status === 'deactivated' || status === 'draft' || status === 'closed') return 'closed';
    if (status === 'sold') return 'sold';
    return 'active';
}

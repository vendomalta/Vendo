// İlanlarım Sayfası Loader - Load More Sistemi
import { getMyListings, deleteListing, updateListing } from './api.js';

let myListings = [];
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
const ITEMS_PER_PAGE = 20;

document.addEventListener('DOMContentLoaded', async () => {
    await loadMyListings();
    setupLoadMoreButton();
    initializeFilters();
});

async function loadMyListings() {
    const container = document.querySelector('.ads-container');
    
    if (!container) {
        console.warn('İlanlar container bulunamadı');
        return;
    }

    try {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top: 1rem; color: var(--text-muted);">İlanlarınız yükleniyor...</p>
            </div>
        `;

        myListings = await getMyListings();
        
        renderListings(myListings);
        updateStats(myListings);
        
        if (myListings.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <h3 style="margin-top: 1rem;">Henüz ilanınız yok</h3>
                    <p style="color: var(--text-muted); margin-top: 0.5rem;">
                        İlk ilanınızı verin ve satışa başlayın!
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = myListings.map(listing => createAdCard(listing)).join('');
        attachActionListeners();
        updateLoadMoreButton();

    } catch (error) {
        console.error('İlanlar yüklenirken hata:', error);
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger);"></i>
                <p style="margin-top: 1rem; color: var(--text-muted);">İlanlar yüklenirken bir hata oluştu</p>
            </div>
        `;
    }
}

function renderListings(listings) {
    const container = document.querySelector('.ads-container');
    if (!container) return;
    if (!listings || listings.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-muted);"></i>
                <h3 style="margin-top: 1rem;">Henüz ilanınız yok</h3>
                <p style="color: var(--text-muted); margin-top: 0.5rem;">
                    İlk ilanınızı verin ve satışa başlayın!
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = listings.map(listing => createAdCard(listing)).join('');
    attachActionListeners();
}

function normalizeId(id) {
    if (id === undefined || id === null) return null;
    const str = String(id).trim();
    if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') return null;
    return str;
}

function createAdCard(listing) {
    const normalizedId = normalizeId(listing?.id);
    if (!listing || !normalizedId) {
        console.warn('İlan kartı atlandı: geçersiz ID', listing);
        return '';
    }
    const normalizedStatus = normalizeStatus(listing.status);
    const imageUrl = listing.photos && listing.photos.length > 0 
        ? listing.photos[0] 
        : 'https://via.placeholder.com/400x300/10b981/ffffff?text=Fotoğraf+Yok';

    const formattedPrice = new Intl.NumberFormat('tr-TR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(listing.price);
    const currency = '€';
    
    const statusBadge = getStatusBadge(normalizedStatus);
    const daysLeft = getDaysLeft(listing.expires_at);

    return `
        <div class="ad-card" data-listing-id="${normalizedId}" data-status="${normalizedStatus}" data-href="ilan-detay.html?id=${normalizedId}">
            <div class="ad-image">
                <img src="${imageUrl}" alt="${escapeHtml(listing.title)}">
                ${statusBadge}
                <div class="ad-views">
                    <i class="fas fa-eye"></i> ${listing.view_count || 0}
                </div>
            </div>
            <div class="ad-content">
                <h3 class="ad-title">${escapeHtml(listing.title)}</h3>
                <p class="ad-location">
                    <i class="fas fa-map-marker-alt"></i>
                    ${escapeHtml(listing.location_city || 'Belirtilmemiş')}
                </p>
                <p class="ad-price">${currency}${formattedPrice}</p>
                <div class="ad-meta">
                    <span class="ad-date">
                        <i class="fas fa-calendar"></i>
                        ${formatDate(listing.created_at)}
                    </span>
                    <span class="ad-expires">
                        <i class="fas fa-clock"></i>
                        ${daysLeft}
                    </span>
                </div>
            </div>
            <div class="ad-actions">
                    <button class="action-btn primary edit-btn" data-id="${normalizedId}" title="Düzenle">
                    <i class="fas fa-edit"></i>
                </button>
                ${normalizedStatus === 'active' 
                    ? `<button class="action-btn warning pause-btn" data-id="${normalizedId}" title="Duraklat"><i class="fas fa-pause"></i></button>`
                    : `<button class="action-btn success activate-btn" data-id="${normalizedId}" title="Aktifleştir"><i class="fas fa-play"></i></button>`
                }
                <button class="action-btn danger delete-btn" data-id="${normalizedId}" title="Sil">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function getStatusBadge(status) {
    const badges = {
        'active': '<div class="ad-badge active">Aktif</div>',
        'inactive': '<div class="ad-badge inactive">Pasif</div>',
        'deactivated': '<div class="ad-badge inactive">Pasif</div>',
        'draft': '<div class="ad-badge inactive">Taslak</div>',
        'closed': '<div class="ad-badge inactive">Pasif</div>',
        'sold': '<div class="ad-badge inactive">Satıldı</div>',
        'expired': '<div class="ad-badge expired">Süresi Dolmuş</div>',
        'pending': '<div class="ad-badge pending">Onay Bekliyor</div>'
    };
    return badges[status] || '';
}

function getDaysLeft(expiresAt) {
    if (!expiresAt) return 'Süresiz';
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffTime = expires - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Süresi doldu';
    if (diffDays === 0) return 'Bugün sona eriyor';
    if (diffDays === 1) return '1 gün kaldı';
    return `${diffDays} gün kaldı`;
}

function attachActionListeners() {
    const container = document.querySelector('.ads-container');
    if (!container) return;

    // Bir kez bağla
    if (container.dataset.actionsBound) return;
    container.dataset.actionsBound = 'true';

    // Kart tıklayınca detay sayfasına git (aksiyon butonuna tıklanmadıysa)
    container.addEventListener('click', function(e) {
        const card = e.target.closest('.ad-card');
        if (!card) return;

        if (e.target.closest('.action-btn') || e.target.closest('.menu-toggle') || e.target.closest('.menu-dropdown')) {
            return;
        }

        const listingId = normalizeId(card.dataset.listingId);
        const href = card.dataset.href || (listingId ? `ilan-detay.html?id=${listingId}` : '');
        if (!listingId || !href) {
            console.warn('Kart tıklaması engellendi: geçersiz ID', card.dataset);
            alert('İlan bağlantısı eksik. Lütfen sayfayı yenileyin.');
            return;
        }
        window.location.href = href;
    });

    // Aksiyonlar (delegation)
    container.addEventListener('click', async function(e) {
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            e.preventDefault();
            e.stopPropagation();
            const listingId = editBtn.dataset.id;
            if (!listingId) return;
            const target = `ilan-detay.html?id=${listingId}&mode=edit`;
            window.location.href = target;
            return;
        }

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const listingId = deleteBtn.dataset.id;
            if (!listingId) return;

            const confirmed = await showConfirmDialog('Bu ilanı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.', 'Sil', 'İptal');
            if (!confirmed) return;

            if (listingId.startsWith('demo-')) {
                const card = deleteBtn.closest('.ad-card');
                if (card) card.remove();
                if (typeof showNotification === 'function') {
                    showNotification('Demo kart silindi', 'success');
                }
                return;
            }

            try {
                await deleteListing(listingId);
                const card = deleteBtn.closest('.ad-card');
                if (card) {
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.9)';
                    setTimeout(() => {
                        card.remove();
                        const remaining = document.querySelectorAll('.ad-card').length;
                        if (remaining === 0) loadMyListings();
                    }, 300);
                }
                if (typeof showNotification === 'function') {
                    showNotification('İlan başarıyla silindi', 'success');
                }
            } catch (error) {
                console.error('Silme hatası:', error);
                if (typeof showNotification === 'function') {
                    showNotification('Hata: ' + error.message, 'error');
                }
            }
            return;
        }

        const statusBtn = e.target.closest('.pause-btn, .activate-btn');
        if (statusBtn) {
            e.preventDefault();
            e.stopPropagation();
            const listingId = statusBtn.dataset.id;
            if (!listingId) return;

            const card = statusBtn.closest('.ad-card');
            const currentStatus = normalizeStatus(card?.dataset.status || 'active');
            openStatusMenu(statusBtn, listingId, currentStatus, card);
            return;
        }
    });
}

function setCardStatus(card, newStatus, listingId) {
    if (!card) return;
    const normalized = normalizeStatus(newStatus);
    card.dataset.status = normalized;

    const badge = card.querySelector('.ad-badge');
    if (badge) {
        badge.classList.remove('active', 'inactive', 'expired', 'pending');
        const badgeClass = normalized === 'active' ? 'active' : 'inactive';
        badge.classList.add(badgeClass);
        // Show appropriate Turkish text based on normalized status
        let badgeText = 'Pasif';
        if (normalized === 'active') badgeText = 'Aktif';
        else if (normalized === 'sold') badgeText = 'Satıldı';
        badge.textContent = badgeText;
    }

    const actions = card.querySelector('.ad-actions');
    if (!actions) return;

    const existingToggle = actions.querySelector('.pause-btn, .activate-btn');
    if (existingToggle) {
        const newBtn = document.createElement('button');
        if (normalized === 'active') {
            newBtn.className = 'action-btn warning pause-btn';
            newBtn.title = 'Duraklat';
            newBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            newBtn.className = 'action-btn success activate-btn';
            newBtn.title = 'Aktifleştir';
            newBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
        newBtn.dataset.id = listingId || existingToggle.dataset.id;
        existingToggle.replaceWith(newBtn);
    }
}

function normalizeStatus(status) {
    if (!status) return 'active';
    // Map all passive states to 'closed' for DB compatibility
    if (status === 'inactive' || status === 'deactivated' || status === 'draft' || status === 'closed') return 'closed';
    if (status === 'sold') return 'sold';
    if (status === 'active') return 'active';
    // Fallback to closed for unknown statuses
    return 'closed';
}

async function changeListingStatus(listingId, targetStatus) {
    // targetStatus is already normalized to DB-valid value
    // ONLY use DB-valid status values: 'active', 'draft', 'closed', 'sold', 'deactivated'
    const attempts = targetStatus === 'active'
        ? ['active']
        : targetStatus === 'sold'
            ? ['sold']
            : ['closed', 'deactivated', 'draft'];

    let lastError;
    for (const status of attempts) {
        try {
            await updateListing(listingId, { status });
            return status;
        } catch (error) {
            lastError = error;
            const msg = String(error?.message || '').toLowerCase();
            if (/status/i.test(msg) || /constraint/i.test(msg) || /check/i.test(msg)) {
                continue; // dene ve diğer statü ile tekrar
            }
            throw error;
        }
    }
    throw lastError || new Error('Duraklatma/aktifleştirme başarısız');
}

// Durum menüsü: edit sayfasındaki seçeneklerle aynı (Aktif, Pasif, Satıldı)
let openStatusMenuRef = null;

function ensureStatusMenuStyles() {
    if (document.getElementById('status-menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'status-menu-styles';
    style.textContent = `
        .status-quick-menu {
            position: absolute;
            background: var(--surface, #ffffff);
            border: 1px solid var(--gray-200, #e2e8f0);
            box-shadow: 0 8px 20px rgba(0,0,0,0.12);
            border-radius: 10px;
            padding: 0.35rem 0.25rem;
            z-index: 9999;
            min-width: 180px;
        }
        .status-quick-menu button {
            width: 100%;
            border: none;
            background: transparent;
            padding: 0.5rem 0.75rem;
            text-align: left;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text, #1e293b);
            cursor: pointer;
            font-weight: 600;
        }
        .status-quick-menu button:hover { background: var(--muted-surface, #f1f5f9); }
        .status-quick-menu .status-active { color: var(--success, #10b981); }
        .status-quick-menu .status-inactive { color: var(--warning, #f59e0b); }
        .status-quick-menu .status-sold { color: var(--gray-600, #475569); }
    `;
    document.head.appendChild(style);
}

function closeStatusMenu() {
    if (openStatusMenuRef) {
        openStatusMenuRef.remove();
        openStatusMenuRef = null;
    }
    document.removeEventListener('click', handleOutsideMenuClick, true);
    window.removeEventListener('scroll', closeStatusMenu, true);
    window.removeEventListener('resize', closeStatusMenu);
}

function handleOutsideMenuClick(e) {
    if (openStatusMenuRef && !openStatusMenuRef.contains(e.target)) {
        closeStatusMenu();
    }
}

function openStatusMenu(triggerBtn, listingId, currentStatus, card) {
    ensureStatusMenuStyles();
    closeStatusMenu();

    const menu = document.createElement('div');
    menu.className = 'status-quick-menu';
    menu.innerHTML = `
        <button type="button" data-status-option="active" class="status-active">✅ Aktif</button>
        <button type="button" data-status-option="closed" class="status-inactive">⏸️ Pasif</button>
        <button type="button" data-status-option="sold" class="status-sold">✔️ Satıldı</button>
    `;

    const rect = triggerBtn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 6}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;

    menu.addEventListener('click', async (evt) => {
        const option = evt.target.closest('[data-status-option]');
        if (!option) return;
        const targetStatus = option.dataset.statusOption;
        closeStatusMenu();
        await applyStatusChange(listingId, targetStatus, card);
    });

    document.body.appendChild(menu);
    openStatusMenuRef = menu;
    setTimeout(() => {
        document.addEventListener('click', handleOutsideMenuClick, true);
        window.addEventListener('scroll', closeStatusMenu, true);
        window.addEventListener('resize', closeStatusMenu);
    }, 0);
}

async function applyStatusChange(listingId, targetStatus, card) {
    // Normalize IMMEDIATELY to ensure we only use DB-valid values
    const normalizedTarget = targetStatus === 'inactive' ? 'closed' : targetStatus;
    const previousStatus = normalizeStatus(card?.dataset.status || 'active');

    if (listingId.startsWith('demo-')) {
        setCardStatus(card, normalizedTarget, listingId);
        if (typeof showNotification === 'function') {
            showNotification(`Demo ilan durumu ${statusLabel(normalizedTarget)} olarak güncellendi`, 'success');
        }
        return;
    }

    setCardStatus(card, normalizedTarget, listingId);

    try {
        await changeListingStatus(listingId, normalizedTarget);
        await loadMyListings();
        if (typeof showNotification === 'function') {
            showNotification(`İlan ${statusLabel(normalizedTarget)} olarak güncellendi`, 'success');
        }
    } catch (error) {
        console.error('Durum güncelleme hatası:', error);
        setCardStatus(card, previousStatus, listingId);
        if (typeof showNotification === 'function') {
            showNotification('Durum güncellenemedi: ' + (error?.message || 'Bilinmeyen hata'), 'error');
        }
    }
}

function statusLabel(status) {
    if (status === 'active') return 'aktif';
    if (status === 'sold') return 'satıldı';
    return 'pasif';
}

function updateStats(listings) {
    const totalViews = listings.reduce((sum, l) => sum + (l.view_count || 0), 0);
    const activeCount = listings.filter(l => normalizeStatus(l.status) === 'active').length;
    const inactiveCount = listings.filter(l => normalizeStatus(l.status) === 'closed').length;
    const soldCount = listings.filter(l => normalizeStatus(l.status) === 'sold').length;

    const stats = document.querySelectorAll('.stats-grid .stat-card h3');
    if (stats[0]) stats[0].textContent = totalViews;
    if (stats[1]) stats[1].textContent = activeCount;
    if (stats[2]) stats[2].textContent = inactiveCount;
    if (stats[3]) stats[3].textContent = soldCount;

    // Tab sayılarını güncelle
    document.querySelectorAll('.tab-btn').forEach(tab => {
        const filter = tab.dataset.filter;
        let count = listings.length;
        
        if (filter === 'active') count = activeCount;
        else if (filter === 'inactive') count = inactiveCount;
        else if (filter === 'sold') count = soldCount;
        
        const label = tab.textContent.split('(')[0].trim();
        tab.textContent = `${label} (${count})`;
    });
}

function initializeFilters() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const filter = tab.dataset.filter;
            let filtered = myListings;
            if (filter === 'active') filtered = myListings.filter(l => normalizeStatus(l.status) === 'active');
            else if (filter === 'inactive') filtered = myListings.filter(l => normalizeStatus(l.status) === 'closed');
            else if (filter === 'sold') filtered = myListings.filter(l => normalizeStatus(l.status) === 'sold');

            renderListings(filtered);
            updateStats(myListings);
        });
    });
}



function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Load More butonunu setup et
 */
function setupLoadMoreButton() {
    const loadMoreBtn = document.querySelector('.load-more-btn');
    const loadMoreContainer = document.querySelector('.load-more-container');
    
    if (!loadMoreBtn) return;
    
    loadMoreBtn.addEventListener('click', async () => {
        if (isLoading || currentPage >= totalPages) return;
        
        isLoading = true;
        const loadingText = loadMoreContainer.querySelector('.loading-text');
        
        loadMoreBtn.disabled = true;
        loadMoreBtn.style.opacity = '0.5';
        if (loadingText) loadingText.style.display = 'block';
        
        // Sonraki sayfa yükle
        await loadMyListingsMore(currentPage + 1);
        
        isLoading = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.style.opacity = '1';
        if (loadingText) loadingText.style.display = 'none';
        
        // Tüm sayfalar yüklendiyse butonu gizle
        if (currentPage >= totalPages) {
            loadMoreContainer.style.display = 'none';
        }
    });
}

/**
 * Daha fazla ilanları yükle (append mode)
 */
async function loadMyListingsMore(pageNum) {
    try {
        const moreListings = await getMyListings({ page: pageNum });
        
        if (moreListings && moreListings.length > 0) {
            const container = document.querySelector('.ads-container');
            if (container) {
                const newCards = moreListings.map(listing => createAdCard(listing)).join('');
                container.innerHTML += newCards;
                attachActionListeners();
            }
            
            currentPage = pageNum;
            myListings = myListings.concat(moreListings);
            updateLoadMoreButton();
        }
    } catch (error) {
        console.error('Daha fazla ilan yüklenirken hata:', error);
    }
}

/**
 * Load More butonunu göster/gizle
 */
function updateLoadMoreButton() {
    const loadMoreContainer = document.querySelector('.load-more-container');
    if (!loadMoreContainer) return;
    
    // Daha fazla ilanlar var mı?
    if (myListings.length > 0 && myListings.length % ITEMS_PER_PAGE === 0) {
        loadMoreContainer.style.display = 'block';
    } else {
        loadMoreContainer.style.display = 'none';
    }
}

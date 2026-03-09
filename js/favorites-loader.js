// Favoriler Sayfası Loader
import { getFavorites, removeFromFavorites } from './api.js';
import { supabase } from './supabase.js';

function normalizeId(id) {
    if (id === undefined || id === null) return null;
    const str = String(id).trim();
    if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') return null;
    return str;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Giriş kontrolü yap
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.warn('⚠️ Unauthenticated user tried to access favorites page');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            return;
        }
        
        await loadFavorites();
    } catch (error) {
        console.error('Error loading favorites:', error);
        if (error.message.includes('User')) {
            window.location.href = 'login.html';
        }
    }
});

// Tüm favorileri sakla global'de
let allFavorites = [];
let currentFilter = 'all';

async function loadFavorites() {
    const container = document.querySelector('.favorites-grid');
    
    if (!container) {
        console.warn('Favorites container not found');
        return;
    }

    try {
        // Show loading
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top: 1rem; color: var(--text-muted);">Loading favorites...</p>
            </div>
        `;

        allFavorites = await getFavorites();
        
        // İstatistikleri güncelle
        updateStats(allFavorites);
        
        if (allFavorites.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-heart-broken" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <h3 style="margin-top: 1rem;">You don't have any favorite listings yet</h3>
                    <p style="color: var(--text-muted); margin-top: 0.5rem;">
                        You can add your favorite listings by clicking the heart icon
                    </p>
                    <a href="index.html" class="btn-primary" style="margin-top: 1.5rem; display: inline-block; padding: 0.75rem 2rem; text-decoration: none;">
                        <i class="fas fa-home"></i> Return to Home
                    </a>
                </div>
            `;
            attachFilterListeners(allFavorites);
            return;
        }

        // Başlangıçta tümünü göster
        renderFavorites(allFavorites);

        // Event listener'ları ekle
        attachRemoveListeners();
            attachCardClickListeners();
            attachFilterListeners(allFavorites);
        attachFilterListeners(allFavorites);

    } catch (error) {
        console.error('Error loading favorites:', error);
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger);"></i>
                <p style="margin-top: 1rem; color: var(--text-muted);">An error occurred while loading favorites</p>
            </div>
        `;
    }
}

function renderFavorites(favorites) {
    const container = document.querySelector('.favorites-grid');
    if (favorites.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-heart-broken" style="font-size: 3rem; color: var(--text-muted);"></i>
                <h3 style="margin-top: 1rem;">You don't have any favorite listings in this category</h3>
            </div>
        `;
    } else {
        container.innerHTML = favorites.map(listing => createFavoriteCard(listing)).join('');
    }
    
    // Re-attach listeners after rendering
    setTimeout(() => {
        attachRemoveListeners();
        attachCardClickListeners();
        attachActionListeners();
    }, 0);
}

function attachActionListeners() {
    // Mesaj Gönder Butonu
    document.querySelectorAll('.send-message-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();

            const listingId = this.dataset.listingId;
            const sellerId = this.dataset.sellerId;

            // Prevent sending message to own listing
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.id === sellerId) {
                if (typeof showNotification === 'function') {
                    showNotification('You cannot send a message to your own listing', 'warning');
                } else {
                    alert('You cannot send a message to your own listing');
                }
                return;
            }

            if (listingId && sellerId) {
                window.location.href = `mesajlar.html?listing_id=${listingId}&seller_id=${sellerId}`;
            } else {
                console.error('Missing info:', { listingId, sellerId });
                if (typeof showNotification === 'function') {
                    showNotification('Cannot send message: missing listing information', 'error');
                }
            }
        });
    });

    // Paylaş Butonu (Hazır el atmışken bunu da ekleyelim)
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const listingId = this.dataset.listingId;
            const url = `${window.location.origin}/ilan-detay.html?id=${listingId}`;
            
            if (navigator.share) {
                navigator.share({
                    title: 'VENDO Listing',
                    url: url
                }).catch(console.error);
            } else {
                navigator.clipboard.writeText(url).then(() => {
                    if (typeof showNotification === 'function') {
                        showNotification('Link copied', 'success');
                    } else {
                        alert('Link copied');
                    }
                });
            }
        });
    });
}

function createFavoriteCard(listing) {
    const normalizedId = normalizeId(listing?.id);
    if (!listing || !normalizedId) {
        console.warn('Favorite card skipped: no ID or invalid', listing);
        return '';
    }
    const imageUrl = listing.photos && listing.photos.length > 0 
        ? listing.photos[0] 
        : 'https://via.placeholder.com/400x300/10b981/ffffff?text=No+Photo';

    const formattedPrice = new Intl.NumberFormat('tr-TR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(listing.price);
    const currency = '€';

    return `
        <div class="favorite-card" data-listing-id="${normalizedId}" data-href="ilan-detay.html?id=${normalizedId}">
            <div class="favorite-image">
                <img src="${imageUrl}" alt="${escapeHtml(listing.title)}">
            <button class="favorite-remove" data-listing-id="${normalizedId}" title="Remove from Favorites">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            <div class="favorite-content">
                <h3 class="favorite-title">${escapeHtml(listing.title)}</h3>
                <p class="favorite-price">
                    <span class="current-price">${currency}${formattedPrice}</span>
                </p>
                <p class="favorite-location">
                    <i class="fas fa-map-marker-alt"></i>
                    ${escapeHtml(listing.location_city || 'Not specified')}
                </p>
                <div class="favorite-meta">
                    <span class="added-date">
                        <i class="fas fa-clock"></i>
                        ${formatDate(listing.created_at)}
                    </span>
                    ${listing.status === 'active' ? '<span class="urgency-badge"><i class="fas fa-check-circle"></i> Active</span>' : ''}
                </div>
            </div>
            <div class="favorite-actions">
                <button class="action-btn success send-message-btn" title="Send Message" data-listing-id="${normalizedId}" data-seller-id="${listing.user_id}">
                    <i class="fas fa-envelope"></i>
                </button>
                <button class="action-btn info share-btn" title="Share" data-listing-id="${normalizedId}">
                    <i class="fas fa-share"></i>
                </button>
            </div>
        </div>
    `;
}

function attachRemoveListeners() {
    document.querySelectorAll('.favorite-remove').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();

            const listingId = this.dataset.listingId;
            
            let _ok = false;
            if (typeof showConfirmDialog === 'function') {
                _ok = await showConfirmDialog('Are you sure you want to remove this listing from your favorites?');
            } else {
                if (typeof showNotification === 'function') {
                    showNotification('Approval required: confirm removal from favorites', 'info');
                } else if (typeof showInlineToast === 'function') {
                    showInlineToast('Approval required: confirm removal from favorites', 'info');
                } else {
                    console.warn('Approval required: confirm removal from favorites');
                }
                return;
            }
            if (!_ok) return;

            try {
                await removeFromFavorites(listingId);
                
                // Kartı UI'dan kaldır
                const card = this.closest('.favorite-card');
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                
                setTimeout(() => {
                    card.remove();
                    // Eğer başka favori yoksa boş state göster
                    const remaining = document.querySelectorAll('.favorite-card').length;
                    if (remaining === 0) {
                        loadFavorites();
                    }
                }, 300);
                
                if (typeof showNotification === 'function') {
                    showNotification('Removed from favorites', 'success');
                }
            } catch (error) {
                console.error('Error removing from favorites:', error);
                if (typeof showNotification === 'function') {
                    showNotification('Error: ' + error.message, 'error');
                } else if (typeof showInlineToast === 'function') {
                    showInlineToast('Error: ' + error.message, 'error');
                } else {
                    console.error('Error: ' + error.message);
                }
            }
        });
    });
}

function attachCardClickListeners() {
    document.querySelectorAll('.favorite-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function(e) {
            if (e.target.closest('.favorite-remove') || e.target.closest('.favorite-actions')) return;
            const listingId = normalizeId(this.dataset.listingId);
            const href = this.dataset.href || (listingId ? `ilan-detay.html?id=${listingId}` : '');
            if (!listingId || !href) {
                console.warn('Favorite card click prevented: invalid ID', this.dataset);
                if (typeof showNotification === 'function') {
                    showNotification('Listing link missing. Please refresh the page.', 'warning');
                } else if (typeof showInlineToast === 'function') {
                    showInlineToast('Listing link missing. Please refresh the page.', 'warning');
                } else {
                    console.warn('Listing link missing. Please refresh the page.');
                }
                return;
            }
            window.location.href = href;
        });
    });
}

function updateStats(favorites) {
    const totalCount = favorites.length;
    
    // Toplam favori
    const totalStat = document.querySelector('.stats-grid .stat-card:nth-child(1) h3');
    if (totalStat) totalStat.textContent = totalCount;
    
    // Bu hafta eklenen (son 7 gün)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = favorites.filter(f => new Date(f.created_at) > weekAgo).length;
    const weekStat = document.querySelector('.stats-grid .stat-card:nth-child(2) h3');
    if (weekStat) weekStat.textContent = thisWeek;
    
    // Tab sayılarını güncelle
    document.querySelectorAll('.tab-btn').forEach(tab => {
        const filter = tab.dataset.filter;
        if (filter === 'all') {
            tab.textContent = `All (${totalCount})`;
        } else {
            const count = favorites.filter(f => f.category === filter).length;
            const label = getFilterLabel(filter);
            tab.textContent = `${label} (${count})`;
        }
    });
}

function getFilterLabel(filter) {
    const labels = {
        'emlak': 'Real Estate',
        'vasita': 'Vehicles',
        'elektronik': 'Electronics',
        'ev_esyasi': 'Home Goods'
    };
    return labels[filter] || filter;
}

function attachFilterListeners(favorites) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            currentFilter = this.dataset.filter;
            
            // Aktif buton göster
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Filtrelenmiş favorileri göster
            let filtered = favorites;
            if (currentFilter !== 'all') {
                filtered = favorites.filter(f => f.category === currentFilter);
            }
            
            renderFavorites(filtered);
        });
    });
    
    // Search listener
    const searchInput = document.querySelector('.ads-search');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase();
            let filtered = favorites;
            
            // Önce kategori filtresi uygula
            if (currentFilter !== 'all') {
                filtered = filtered.filter(f => f.category === currentFilter);
            }
            
            // Sonra arama filtresi uygula
            if (query) {
                filtered = filtered.filter(f => 
                    f.title.toLowerCase().includes(query) || 
                    f.location.toLowerCase().includes(query)
                );
            }
            
            renderFavorites(filtered);
        });
    }
    
    // Sort listener
    const sortSelect = document.querySelector('.sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', function(e) {
            let filtered = [...allFavorites];
            const sortValue = e.target.value;
            
            // Önce kategori filtresi uygula
            if (currentFilter !== 'all') {
                filtered = filtered.filter(f => f.category === currentFilter);
            }
            
            // Sıralama yap
            switch(sortValue) {
                case 'date-desc':
                    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    break;
                case 'date-asc':
                    filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                    break;
                case 'price-asc':
                    filtered.sort((a, b) => a.price - b.price);
                    break;
                case 'price-desc':
                    filtered.sort((a, b) => b.price - a.price);
                    break;
                case 'title-asc':
                    filtered.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
                    break;
            }
            
            renderFavorites(filtered);
        });
    }
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

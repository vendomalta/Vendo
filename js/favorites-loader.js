import { getFavorites, removeFromFavorites, isFavorite, getUnreadPriceDrops, markPriceDropAsRead } from './api.js';
import { supabase } from './supabase.js';

// Configuration
let currentPage = 1;
const limit = 10;
let isLoading = false;
let hasMore = true;
let viewMode = localStorage.getItem('vendo_view_mode') || 'grid'; // Default to grid
let droppedListingIds = [];
let activeStatFilter = 'all'; // 'all' or 'dropped'

// Performance optimization: intersection observer for infinite scroll
const observerOptions = {
    root: null,
    rootMargin: '100px',
    threshold: 0.1
};

const sentinel = document.getElementById('scroll-sentinel');
const loadingSpinner = document.getElementById('loading-spinner');
const container = document.querySelector('.favorites-grid');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            return;
        }

        viewMode = localStorage.getItem('vendo_view_mode') || 'grid';
        initViewToggle();
        
        // Fetch Price Drops and Init Stat Cards
        await initializeStatCards();
        
        await initPage();
        
        // Setup Infinite Scroll
        const observer = new IntersectionObserver(handleIntersect, observerOptions);
        if (sentinel) observer.observe(sentinel);

    } catch (error) {
        console.error('Initialization error:', error);
    }
});

async function initializeStatCards() {
    // Fetch unread price drops from notifications
    droppedListingIds = await getUnreadPriceDrops();
    
    const totalCard = document.getElementById('show-all-favs');
    const dropCard = document.getElementById('show-dropped-favs');
    const tabs = document.querySelectorAll('.filter-tabs .tab-btn');

    const updateActiveUI = () => {
        // Update Stat Cards (Optional visual cue)
        if (activeStatFilter === 'all') {
            totalCard?.classList.add('active');
            dropCard?.classList.remove('active');
        } else {
            dropCard?.classList.add('active');
            totalCard?.classList.remove('active');
        }

        // Update Tabs (Main visual cue)
        tabs.forEach(tab => {
            if (tab.dataset.filter === activeStatFilter) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    };

    const handleFilterChange = async (filter) => {
        if (activeStatFilter === filter) return;
        activeStatFilter = filter;
        updateActiveUI();
        await initPage();
    };

    // Binding for Stats Cards
    totalCard?.addEventListener('click', () => handleFilterChange('all'));
    dropCard?.addEventListener('click', () => handleFilterChange('dropped'));

    // Binding for Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => handleFilterChange(tab.dataset.filter));
    });

    updateActiveUI();
}

function initViewToggle() {
    const listBtn = document.getElementById('list-view-btn');
    const gridBtn = document.getElementById('grid-view-btn');
    const mobileToggle = document.querySelector('.view-toggle-btn');

    const updateUI = () => {
        if (viewMode === 'list') {
            container.classList.add('list-view');
            listBtn?.classList.add('active');
            gridBtn?.classList.remove('active');
            if (mobileToggle) mobileToggle.innerHTML = '<i class="fas fa-list"></i>';
        } else {
            container.classList.remove('list-view');
            gridBtn?.classList.add('active');
            listBtn?.classList.remove('active');
            if (mobileToggle) mobileToggle.innerHTML = '<i class="fas fa-th-large"></i>';
        }
    };

    listBtn?.addEventListener('click', () => {
        viewMode = 'list';
        localStorage.setItem('vendo_view_mode', 'list');
        updateUI();
    });

    gridBtn?.addEventListener('click', () => {
        viewMode = 'grid';
        localStorage.setItem('vendo_view_mode', 'grid');
        updateUI();
    });

    mobileToggle?.addEventListener('click', () => {
        viewMode = viewMode === 'grid' ? 'list' : 'grid';
        localStorage.setItem('vendo_view_mode', viewMode);
        updateUI();
    });

    updateUI();
}

async function initPage() {
    currentPage = 1;
    hasMore = true;
    container.innerHTML = '';
    await fetchAndRender();
}

async function handleIntersect(entries) {
    if (entries[0].isIntersecting && !isLoading && hasMore) {
        currentPage++;
        await fetchAndRender();
    }
}

async function fetchAndRender() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    if (loadingSpinner) loadingSpinner.style.display = 'flex';

    try {
        const { favorites, totalCount } = await getFavorites({
            page: currentPage,
            limit: limit,
            categoryId: 'all',
            onlyDropped: activeStatFilter === 'dropped',
            droppedListingIds: droppedListingIds
        });

        // Update stats on first load
        if (currentPage === 1) {
            const totalEl = document.getElementById('total-favorites-count');
            const dropEl = document.getElementById('price-drop-count');
            
            // Total is always the full favorites count (but getFavorites with onlyDropped returns filtered count)
            // So if we are in 'all' filter, we update total. 
            // Better: mobile app fetch call separately gets total.
            // For now, if activeStatFilter is 'all', totalCount is the total.
            if (activeStatFilter === 'all' && totalEl) totalEl.textContent = totalCount;
            if (dropEl) dropEl.textContent = droppedListingIds.length;
        }

        if (favorites.length === 0 && currentPage === 1) {
            hasMore = false;
            showEmptyState();
        } else {
            const fragment = document.createDocumentFragment();
            favorites.forEach(listing => {
                const cardHtml = createFavoriteCard(listing);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHtml;
                fragment.appendChild(tempDiv.firstElementChild);
            });
            container.appendChild(fragment);
            
            if (favorites.length < limit) {
                hasMore = false;
            }
        }
        
        attachActionListeners();

    } catch (error) {
        console.error('Fetch error:', error);
    } finally {
        isLoading = false;
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}

function createFavoriteCard(listing) {
    const normalizedId = listing?.id;
    if (!listing || !normalizedId) return '';
    
    const imageUrl = listing.photos && listing.photos.length > 0 
        ? listing.photos[0] 
        : 'assets/placeholder-listing.jpg';

    const formattedPrice = new Intl.NumberFormat('tr-TR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(listing.price);
    const currency = listing.currency === 'TL' ? '₺' : '€';

    const actionButtons = `
        <button class="action-btn info share-btn" style="flex: 1; justify-content: center;" 
            data-id="${normalizedId}" 
            data-title="${escapeHtml(listing.title)}" 
            data-price="${currency}${formattedPrice}" 
            data-location="${escapeHtml(listing.location_city || 'Malta')}" 
            title="Share">
            <i class="fas fa-share-alt"></i> Share
        </button>
    `;

    const isDropped = droppedListingIds.includes(normalizedId) || droppedListingIds.includes(String(normalizedId));

    return `
        <div class="ad-card favorite-card" data-listing-id="${normalizedId}" data-listing-number="${listing.listing_number || normalizedId}" data-href="ilan-detay.html?id=${normalizedId}">
            <div class="ad-image">
                <img src="${imageUrl}" alt="${escapeHtml(listing.title)}" onerror="this.src='assets/placeholder-listing.jpg'">
                ${isDropped ? `
                <div class="price-drop-badge">
                    <i class="fas fa-trending-down"></i> PRICE DROPPED
                </div>
                ` : ''}
                <button class="favorite-toggle-btn active" data-id="${normalizedId}" title="Remove from Favorites">
                    <i class="fas fa-heart"></i>
                </button>
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

function attachActionListeners() {
    const cards = container.querySelectorAll('.ad-card:not([data-listeners-bound])');
    cards.forEach(card => {
        card.dataset.listenersBound = 'true';
        
        card.addEventListener('click', async (e) => {
            if (e.target.closest('.action-btn') || e.target.closest('.placeholder-btn') || e.target.closest('.favorite-toggle-btn')) return;
            
            const listingId = card.dataset.listingId;
            
            // Mark price drop as read in background if needed
            if (droppedListingIds.includes(listingId) || droppedListingIds.includes(Number(listingId))) {
                markPriceDropAsRead(listingId);
                // Optimistically remove badge and update count
                card.querySelector('.price-drop-badge')?.remove();
                droppedListingIds = droppedListingIds.filter(id => id != listingId);
                const dropEl = document.getElementById('price-drop-count');
                if (dropEl) dropEl.textContent = droppedListingIds.length;
            }
            
            window.location.href = card.dataset.href;
        });

        // Remove logic (Trash Icon)
        card.querySelector('.remove-btn')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to remove this from your favorites?')) {
                try {
                    await removeFromFavorites(card.dataset.listingId);
                    card.remove();
                    if (container.children.length === 0) showEmptyState();
                } catch (err) {
                    alert('Error: ' + err.message);
                }
            }
        });

        // Toggle Favorite logic (Heart Icon - No Confirm)
        card.querySelector('.favorite-toggle-btn')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            const listingId = card.dataset.listingId;
            const isRemoving = btn.classList.contains('active');

            if (isRemoving) {
                // Change UI instantly
                btn.classList.remove('active');
                btn.innerHTML = '<i class="far fa-heart"></i>'; // Hollow heart
                
                try {
                    await removeFromFavorites(listingId);
                    // We keep the card visible as requested, just changing the heart state
                } catch (err) {
                    // Revert UI on error
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="fas fa-heart"></i>';
                    console.error('Failed to remove from favorites:', err);
                }
            } else {
                // If they click it again to re-add? (Optional but good UX)
                btn.classList.add('active');
                btn.innerHTML = '<i class="fas fa-heart"></i>';
                try {
                    const { addFavorite } = await import('./api.js');
                    if (addFavorite) await addFavorite(listingId);
                } catch (err) {
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="far fa-heart"></i>';
                }
            }
        });

        // Message Listener
        card.querySelector('.send-message-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const listingId = card.dataset.listingId;
            const sellerId = e.currentTarget.dataset.sellerId;
            window.location.href = `mesajlar.html?listing_id=${listingId}&seller_id=${sellerId}`;
        });

        // Share Listener
        card.querySelector('.share-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            const listingNumber = card.dataset.listingNumber || card.dataset.listingId;
            const shareUrl = `https://vendomalta.com/listing/${listingNumber}`;
            const title = btn.dataset.title || 'VENDO Listing';
            
            if (navigator.share) {
                // By passing ONLY the url (and title for OS UI context), we force 
                // target apps like WhatsApp to fetch the Open Graph (OG) tags and 
                // render a non-editable rich preview card, exactly like the mobile app.
                navigator.share({ 
                    title: title,
                    url: shareUrl 
                }).catch(console.error);
            } else {
                navigator.clipboard.writeText(shareUrl).then(() => alert('Link copied successfully!'));
            }
        });
    });
}

function showEmptyState() {
    const isDropped = activeStatFilter === 'dropped';
    const iconClass = isDropped ? 'fas fa-tags' : 'fas fa-heart-broken';
    const title = isDropped ? 'No Price Drops Yet' : 'No Favorites Found';
    const message = isDropped 
        ? 'None of your favorite items have dropped in price yet.' 
        : 'Start exploring marketplace to add items to your favorites!';
    
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
            <i class="${iconClass}" style="font-size: 4rem; color: #e2e8f0; margin-bottom: 1.5rem;"></i>
            <h3>${title}</h3>
            <p style="color: #64748b; margin-top: 0.5rem;">${message}</p>
            <a href="/" class="btn-primary" style="display: inline-block; margin-top: 2rem; padding: 0.8rem 2rem; text-decoration: none; background: #10b981; color: white; border-radius: 8px;">
                Explore Marketplace
            </a>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

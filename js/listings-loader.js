// İlanları yükle ve görüntüle
import { getListings, getListing, addToFavorites, removeFromFavorites, isFavorite } from './api.js';
import { managedRequest, cancelRequest } from './request-manager.js';
import { writeCategoryToUrl, readCategoryFromUrl } from './url-sync.js';
import { getCategoryBySlug, getChildCategories } from './category-data.js';
import { showLoading, hideLoading } from './loading.js';
import { sanitizeHTML, sanitizeText, sanitizeURL } from './xss-protection.js';
import { supabase } from './supabase.js';

// Load more sistemi için değişkenler
let currentOffset = 0;
let currentPage = 1;
const LIMIT_PER_LOAD = 30; // 20'den 30'a çıkarıldı - daha az request
let isLoading = false;
let hasMore = true;
let currentFilters = {}; // Son kullanılan filtreler

// Expand given category slugs to include all descendant slugs
function expandCategorySlugs(categories = []) {
    try {
        const expanded = new Set();
        if (Array.isArray(categories) && categories.length > 0) {
            const stack = [...categories];
            while (stack.length) {
                const slug = stack.pop();
                if (!slug) continue;
                const cat = getCategoryBySlug(slug);
                if (cat) {
                    if (!expanded.has(cat.slug)) expanded.add(cat.slug);
                    const children = getChildCategories(cat.id) || [];
                    children.forEach(ch => { if (ch && ch.slug) stack.push(ch.slug); });
                } else {
                    expanded.add(slug);
                }
            }
        }
        return Array.from(expanded);
    } catch (e) {
        console.warn('expandCategorySlugs hata', e);
        return categories;
    }
}

/**
 * İstemci tarafında filtreleri uygula
 * @param {Array} listings - İlan listesi
 * @param {Object} filters - Uygulanacak filtreler
 * @returns {Array} Filtrelenmiş ilanlar
 */
function applyClientFilters(listings, filters) {
    return listings.filter(listing => {
        const extra = listing.extra_fields || {};

        for (const [filterKey, filterValue] of Object.entries(filters)) {
            if (!filterValue) continue;

            const listingValue = extra[filterKey];

            if (Array.isArray(filterValue)) {
                // Checkbox filtreleri - değer arraydeki seçeneklerden biri olmalı
                if (listingValue !== undefined && listingValue !== null) {
                    const matches = filterValue.includes(String(listingValue).toLowerCase());
                    if (!matches) return false;
                } else {
                    return false;
                }
            } else if (typeof filterValue === 'object' && (filterValue.min !== null || filterValue.max !== null)) {
                // Range filtreleri
                const numValue = parseInt(listingValue) || 0;
                if (filterValue.min !== null && numValue < parseInt(filterValue.min)) return false;
                if (filterValue.max !== null && numValue > parseInt(filterValue.max)) return false;
            }
        }

        return true;
    });
}

/**
 * Determine the current page context (home, vehicles, or otomobil)
 */
function getCurrentPageContext() {
    const url = new URL(window.location.href);
    let categories = url.searchParams.get('categories') || '';
    
    // Hash Fallback
    if ((!categories || categories.trim() === '') && window.location.hash) {
        categories = window.location.hash;
    }

    // Check if we're on home page (no specific category)
    if (!categories || categories.trim() === '' || categories === '#/') {
        return 'home'; // Show random listings
    }
    
    // Check if we're viewing Otomobil category
    if (categories.toLowerCase().includes('otomobil')) {
        return 'otomobil'; // Show car listings with filters
    }
    
    // Check if we're viewing any vehicle-related category
    if (categories.toLowerCase().includes('vasıta') || categories.toLowerCase().includes('vasita') || categories.toLowerCase().includes('vehicles')) {
        return 'vehicles'; // Show all vehicle listings
    }
    
    return 'other';
}

// Sayfa yüklendiğinde ilanları getir
document.addEventListener('DOMContentLoaded', async () => {
    // URL'den başlangıç sayfası ve kategoriyi al (varsa)
    let initialOptions = {};
    const pageContext = getCurrentPageContext();
    
    try {
        const url = new URL(window.location.href);
        const qp = parseInt(url.searchParams.get('page'));
        if (!isNaN(qp) && qp > 1) {
            initialOptions.page = qp;
        }
        // Kategori-URL senkronu: URL'den kategorileri oku
        let catParam = readCategoryFromUrl();
        
        // HASH Fallback: Eğer search param yoksa hash'ten oku (#/vasita/otomobil)
        if (catParam.length === 0 && window.location.hash) {
            const hash = window.location.hash.substring(1).replace(/^\//, ''); // vasita/otomobil
            catParam = hash.split('/').filter(Boolean);
        }

        if (catParam.length > 0) {
            // Expand only the last selected category so parent path like
            // /vehicles/cars expands children of 'cars' (not all children of 'vehicles')
            try {
                const last = catParam[catParam.length - 1];
                initialOptions.categories = expandCategorySlugs([last]);
            } catch (e) {
                initialOptions.categories = catParam;
            }
        }
    } catch (_) {}
    
    // Store page context in sessionStorage for sidebar-manager
    sessionStorage.setItem('pageContext', pageContext);
    sessionStorage.setItem('currentCategory', initialOptions.categories ? initialOptions.categories.toString() : '');

    await loadListings(true, initialOptions);
    initLoadMoreButton();
    initInfiniteScroll();
    
    // Sidebar kategori değişimini dinle
    window.addEventListener('categoryChanged', (event) => {
        const { category, categories, categoryKeys } = event.detail;
        // Kategori-URL senkronu: seçimi URL'ye yaz
        writeCategoryToUrl(categories);
        updateSectionTitle(category);
        
        // Update page context based on new category
        let newContext = 'other';
        if (!categories || categories.length === 0) {
            newContext = 'home';
        } else if (String(categories).toLowerCase().includes('otomobil')) {
            newContext = 'otomobil';
        } else if (String(categories).toLowerCase().includes('vasıta') || String(categories).toLowerCase().includes('vasita')) {
            newContext = 'vehicles';
        }
        sessionStorage.setItem('pageContext', newContext);
        sessionStorage.setItem('currentCategory', categories ? String(categories) : '');
        
            // Expand only the last selected category to include its descendants
        try {
            const expandedArr = expandCategorySlugs([category]);
            loadListings(true, { category, categories: expandedArr, ...categoryKeys });
        } catch (e) {
            console.warn('Category expansion failed', e);
            loadListings(true, { category, categories, ...categoryKeys });
        }
    });

    // Backwards-compatible: categoryNavigated from categoryRouter provides path & children
    window.addEventListener('categoryNavigated', (event) => {
        try {
            console.log('🔔 categoryNavigated Event Received:', event.detail);
            const path = event.detail && event.detail.path ? event.detail.path : [];
            const categories = Array.isArray(path) ? path.map(c => c.slug || c.name).filter(Boolean) : [];
            const category = categories.length > 0 ? categories[categories.length - 1] : '';

            console.log('📍 Extracted Categories:', categories, 'Last:', category);

            // Sync URL param for other components
            writeCategoryToUrl(categories);
            updateSectionTitle(category);

            let newContext = 'other';
            if (!categories || categories.length === 0) {
                newContext = 'home';
            } else if (String(categories).toLowerCase().includes('otomobil')) {
                newContext = 'otomobil';
            } else if (String(categories).toLowerCase().includes('vasıta') || String(categories).toLowerCase().includes('vasita') || String(categories).toLowerCase().includes('vehicle')) {
                newContext = 'vehicles';
            }
            
            console.log('🌍 New Page Context:', newContext);

            sessionStorage.setItem('pageContext', newContext);
            sessionStorage.setItem('currentCategory', categories ? String(categories) : '');

            // Expand only the last selected category so we include its descendants
            // (avoid expanding every ancestor which results in overly broad matches)
            const expandedCategories = expandCategorySlugs([category]);
            console.log('🚀 Triggering loadListings with:', { category, categories: expandedCategories });
            loadListings(true, { category, categories: expandedCategories });
        } catch (e) {
            console.warn('categoryNavigated handler error', e);
        }
    });

    // Filtre değişimini dinle
    window.addEventListener('filtersChanged', (event) => {
        const { filters } = event.detail;
        // Filtreleri loadListings'e gönder
        loadListings(true, { filters });
    });
});

/**
 * İlanları yükle ve görüntüle
 * @param {boolean} isFirstLoad - İlk yükleme mi?
 * @param {Object} options - Ek seçenekler
 */
async function loadListings(isFirstLoad = false, options = {}) {
    const listingsGrid = document.querySelector('.listings-grid');
    if (!listingsGrid || isLoading) return;

    isLoading = true;
    
    // Yükleme başladığında görsel geri bildirim ver (özellikle geri tuşu için önemli)
    if (isFirstLoad) {
        // Grid'i temizle ve skeleton göster
        if (listingsGrid) {
            listingsGrid.innerHTML = ''; 
            // Skeleton render biraz aşağıda yapılacak ama önce boşaltalım ki kullanıcı değişimi hissetsin
        }
        try { showLoading('İlanlar yükleniyor...'); } catch (_) {}
    }
    // Eski istekleri iptal et (filtre/sayfa değişimi)
    cancelRequest('listings-main');
    
    // Determine page context and adjust options accordingly
    const pageContext = sessionStorage.getItem('pageContext') || 'home';
    const mergedOptions = { ...currentFilters, ...options };
    
    // Home page: Show random listings (no category filter, add shuffle flag)
    // BUT: if there is a search term, don't use random! We want relevant results.
    if (pageContext === 'home' && !mergedOptions.categories && !mergedOptions.search) {
        mergedOptions.random = true;
        mergedOptions.limit = 20; // Show fewer on home for randomness
    } else if (mergedOptions.search) {
        // Force random off if we are searching
        mergedOptions.random = false;
    }
    
    // Vehicles page: Show all vehicle listings (already filtered by Vasıta category)
    // Otomobil page: Show car listings (already filtered by category)
    
    currentFilters = mergedOptions;
    
    // Update table header and rows based on category
    const tableHeader = document.querySelector('.listings-table-header');
    if (tableHeader) {
        const catList = mergedOptions.categories ? String(mergedOptions.categories).toLowerCase() : '';
        const isVasitaCategory = catList.includes('vasıta') || 
                                catList.includes('vasita') || 
                                catList.includes('otomobil') || 
                                catList.includes('araba') || 
                                catList.includes('cars') || 
                                catList.includes('vehicle');
        
        if (isVasitaCategory) {
            tableHeader.classList.add('show-vehicle-details');
            listingsGrid.classList.add('show-vehicle-details');
        } else {
            tableHeader.classList.remove('show-vehicle-details');
            listingsGrid.classList.remove('show-vehicle-details');
        }
    }

    try {
        // Sayfa değişimi istenmişse (pagination), ilk yükleme gibi davran
        const isPageChange = typeof mergedOptions.page === 'number' && mergedOptions.page > 0;
        // İlk yüklemede veya sayfa değişiminde skeleton göster ve offseti/scroll'u ayarla
        if (isFirstLoad || isPageChange) {
            const skeletonCard = () => `
                <div class="skeleton-card">
                    <div class="skeleton-image"><div class="shimmer"></div></div>
                    <div class="skeleton-content">
                        <div class="skeleton-line lg"><div class="shimmer"></div></div>
                        <div class="skeleton-line md"><div class="shimmer"></div></div>
                        <div class="skeleton-line md"><div class="shimmer"></div></div>
                        <div class="skeleton-line sm"><div class="shimmer"></div></div>
                    </div>
                </div>`;
            listingsGrid.innerHTML = Array.from({ length: 6 }).map(() => skeletonCard()).join('');
            // İstenen sayfaya göre offseti hesapla, yoksa sıfırla
            if (isPageChange) {
                currentPage = mergedOptions.page;
                currentOffset = (currentPage - 1) * LIMIT_PER_LOAD;
                // Kullanıcı deneyimi: yeni sayfaya geçişte üst kısma yakınla
                try {
                    const wrapper = document.querySelector('.featured-listings') || document.body;
                    wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch (_) {}
            } else {
                currentPage = 1;
                currentOffset = 0;
            }
        }

        // API'den ilanları getir (AbortController ve retry ile)
        const page = isPageChange ? mergedOptions.page : (Math.floor(currentOffset / LIMIT_PER_LOAD) + 1);
        const result = await managedRequest('listings-main', async (signal) => {
            return getListings({
                ...mergedOptions,
                page,
                limit: LIMIT_PER_LOAD
            });
        }, { maxRetries: 1, timeoutMs: 10000 });

        // İstemci tarafında filtreleri uygula (sadece gerekli durumlarda)
        let filteredData = result.data;
        
        // Apply brand filter if provided (from sidebar marka seçimi)
        // Bu filtreyi API'ye taşımak daha performanslı olur
        if (mergedOptions.brandName) {
            filteredData = filteredData.filter(listing => {
                const extra = listing.extra_fields || {};
                return extra.marka === mergedOptions.brandName;
            });
        }
        
        // Apply other client-side filters - sadece küçük veri setlerinde
        if (mergedOptions.filters && Object.keys(mergedOptions.filters).length > 0 && result.data.length < 100) {
            filteredData = applyClientFilters(filteredData, mergedOptions.filters);
        }
        
        if (isFirstLoad && filteredData.length === 0) {
            listingsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <p style="margin-top: 1rem; color: var(--text-muted);">Filtreye uygun ilan bulunmuyor</p>
                </div>
            `;
            hasMore = false;
            updateLoadMoreButton();
            return;
        }

        const validListings = filteredData.filter(item => !!normalizeId(item?.id));
        const invalidListings = filteredData.filter(item => !normalizeId(item?.id));
        if (invalidListings.length > 0) {
            console.warn('Geçersiz ID nedeniyle atlanan ilanlar:', invalidListings.map(l => l && l.id));
        }

        // İlanları render et
        const newListingsHTML = validListings.map(listing => createListingCard(listing)).join('');
        
        if (isFirstLoad) {
            // ✅ GÜVENLI: DOMPurify ile sanitize et
            listingsGrid.innerHTML = sanitizeHTML(newListingsHTML);
        } else {
            // ✅ GÜVENLI: DOMPurify ile sanitize et
            const sanitized = sanitizeHTML(newListingsHTML);
            listingsGrid.insertAdjacentHTML('beforeend', sanitized);
        }

        // Sayfa/offset durumunu güncelle
        currentPage = page;
        currentOffset = (currentPage - 1) * LIMIT_PER_LOAD + filteredData.length;
        
        // Daha fazla ilan var mı kontrol et
        hasMore = filteredData.length === LIMIT_PER_LOAD && currentOffset < result.totalCount;

        // Favori, kart tıklaması, mesaj ve hover önizleme listener'larını ekle
        attachFavoriteListeners();
        attachCardClickListeners();
        attachMessageButtonListeners();
        attachHoverGalleryPreview();
        
        // Prefetch sadece mobil değilse (performans için)
        if (window.innerWidth > 768) {
            attachPrefetchOnHover();
        }

        // Lazy loading observer'ı tetikle (varsa)
        if (window.LazyLoader) {
            window.LazyLoader.observeNewImages();
        }

        // Load more butonunu güncelle
        updateLoadMoreButton();

        return result;

    } catch (error) {
        console.error('İlanlar yüklenirken hata:', error);
        const msg = (error && (error.message || error.error_description || error.code)) || 'Bilinmeyen hata';
        let hint = '';
        if (/401|permission|rls|policy/i.test(String(msg))) {
            hint = 'Supabase RLS politikaları "listings" tablosu için SELECT iznini engelliyor. Supabase SQL Editor\'da RLS-FIX.sql dosyasını çalıştırın.';
        } else if (/403|forbidden|not allowed/i.test(String(msg))) {
            hint = 'Auth/Key yetkisi reddedildi. js/supabase.js içindeki anon public key\'i ve CORS/URL ayarlarını kontrol edin.';
        }
        if (isFirstLoad) {
            listingsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger);"></i>
                    <p style="margin-top: .75rem; color: var(--text); font-weight:600">İlanlar yüklenirken bir hata oluştu</p>
                    <p style="margin-top: .25rem; color: var(--muted); font-size:.9rem">Detay: ${escapeHtml(String(msg))}</p>
                    ${hint ? `<p style="margin-top:.25rem; color: var(--gray-500); font-size:.85rem">İpucu: ${escapeHtml(hint)}</p>` : ''}
                </div>
            `;
        }
        hasMore = false;
        updateLoadMoreButton();
    } finally {
        try { hideLoading(); } catch (_) {}
        isLoading = false;
    }
}

/**
 * İlan kartı HTML'i oluştur - Optimize edilmiş versiyon
 */
function normalizeId(id) {
    if (id === undefined || id === null) return null;
    const str = String(id).trim();
    if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') return null;
    return str;
}

function createListingCard(listing) {
    const normalizedId = normalizeId(listing?.id);
    if (!listing || !normalizedId) {
        console.warn('Listing kartı atlandı: ID bulunamadı veya geçersiz', listing);
        return '';
    }
    const photos = Array.isArray(listing.photos) ? listing.photos : [];
    // Lazy loading için placeholder kullan, gerçek görsel yüklemesini lazy load yapsın
    const imageUrl = photos.length > 0 ? photos[0] : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%2310b981" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="white" text-anchor="middle"%3EFoto%C4%9Fraf Yok%3C/text%3E%3C/svg%3E';
    const imageCount = photos.length || 1;

    const formattedPrice = new Intl.NumberFormat('tr-TR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(listing.price);
    // Force Euro symbol for display
    const currency = '€';

    const priceText = `${currency}${formattedPrice}`;
    const titleText = escapeHtml(listing.title || 'İlan');
    // Clean location: remove null/undefined values
    const rawLocation = listing.location || '';
    const locationParts = rawLocation.split(',').map(p => p.trim()).filter(p => p && p !== 'null' && p !== 'undefined');
    const locationText = locationParts.length > 0 ? escapeHtml(locationParts.join(', ')) : 'Belirtilmemiş';
    const postedTime = formatDate(listing.created_at);

    const km = listing.extra_fields?.km || '';
    const fuel = listing.extra_fields?.fuel || listing.extra_fields?.yakıt || '';
    const transmission = listing.extra_fields?.transmission || listing.extra_fields?.vites || '';
    const area = listing.extra_fields?.area || listing.extra_fields?.metrekare || '';
    const rooms = listing.extra_fields?.rooms || listing.extra_fields?.oda_sayisi || '';
    const baths = listing.extra_fields?.baths || listing.extra_fields?.banyo_sayisi || '';
    const year = listing.extra_fields?.year || listing.extra_fields?.yıl || '';
    const color = listing.extra_fields?.color || listing.extra_fields?.renk || '';
    const model = listing.extra_fields?.model || '';
    const brand = listing.extra_fields?.brand || listing.extra_fields?.marka || '';
    const categoryText = listing.category_name || listing.category || listing.category_slug || brand || model || '';

    function renderSpecs() {
        const category = (listing.category || listing.category_name || listing.category_slug || '').toLowerCase();
        if (category.includes('vasıta') || category.includes('araba') || (km || fuel || transmission)) {
            return `
                <div class="listing-specs">
                    <div class="spec"><i class="fas fa-tachometer-alt"></i><span>${escapeHtml(km)}</span></div>
                    <div class="spec"><i class="fas fa-gas-pump"></i><span>${escapeHtml(fuel)}</span></div>
                    <div class="spec"><i class="fas fa-cogs"></i><span>${escapeHtml(transmission)}</span></div>
                </div>
            `;
        }
        if (category.includes('emlak') || category.includes('konut') || category.includes('daire') || (area || rooms || baths)) {
            return `
                <div class="listing-specs">
                    <div class="spec"><i class="fas fa-ruler-combined"></i><span>${escapeHtml(area)}</span></div>
                    <div class="spec"><i class="fas fa-bed"></i><span>${escapeHtml(rooms)}</span></div>
                    <div class="spec"><i class="fas fa-bath"></i><span>${escapeHtml(baths)}</span></div>
                </div>
            `;
        }
        return `
            <div class="listing-specs">
                <div class="spec"><i class="fas fa-tag"></i><span>${escapeHtml(listing.extra_fields?.brand || '')}</span></div>
                <div class="spec"><i class="fas fa-info-circle"></i><span>${escapeHtml(listing.extra_fields?.condition || '')}</span></div>
                <div class="spec"><i class="fas fa-cube"></i><span>${escapeHtml(listing.extra_fields?.model || '')}</span></div>
            </div>
        `;
    }

    const sellerName = listing.seller_name || listing.profile_name || '';
    const sellerVerified = listing.seller_verified || false;
    const sellerActiveCount = listing.seller_active_ads_count || '';
    const sellerRating = listing.seller_rating || '';
    const sellerRatingCount = listing.seller_rating_count || '';
    const sellerMemberSince = listing.seller_member_since || '';

    return `
        <a href="ilan-detay.html?id=${normalizedId}" class="listing-card verde-card" style="text-decoration: none; color: inherit;" data-listing-id="${normalizedId}" data-seller-id="${listing.user_id || ''}" data-href="ilan-detay.html?id=${normalizedId}">
            <div class="table-media">
                <div class="listing-image">
                    <img class="lazy-blur" src="data:image/gif;base64,R0lGODlhAQABAPAAAP///wAAACwAAAAAAQABAEACAkQBADs=" data-src="${imageUrl}" alt="${titleText}" loading="lazy" decoding="async" width="400" height="300" ${photos[1] ? `data-hover-src="${photos[1]}"` : ''}>
                    <button class="favorite-button" data-listing-id="${listing.id}">
                        <i class="far fa-heart"></i>
                    </button>
                    ${listing.status === 'active' ? '<span class="listing-badge active">Aktif</span>' : ''}
                    <div class="gallery-count"><i class="fas fa-camera"></i><span>${imageCount}</span></div>
                </div>
                <div class="table-model">${escapeHtml(categoryText || '—')}</div>
            </div>
            <div class="listing-content">
                <div class="price-title">
                    <h3 class="listing-title verde-title">${titleText}</h3>
                </div>
                ${year ? `<div class="list-extra-info"><div class="list-year"><i class="fas fa-calendar"></i> ${escapeHtml(year)}</div></div>` : ''}
                <div class="table-fields">
                    <div class="table-title">${titleText}</div>
                    <div class="table-km">${escapeHtml(km || '—')}</div>
                    <div class="table-color">${escapeHtml(color || '—')}</div>
                    <div class="table-year">${escapeHtml(year || '—')}</div>
                    <div class="table-location"><span class="table-date">${postedTime}</span><span class="table-location-text">${locationText}</span></div>
                    <div class="table-price">${priceText}</div>
                </div>
                <div class="listing-actions">
                    <div class="listing-meta verde-meta listing-meta-inline">
                        <div class="listing-location verde-location"><i class="fas fa-map-marker-alt"></i> ${locationText}</div>
                        <div class="listing-price verde-price">${priceText}</div>
                        <div class="listing-date"><i class="fas fa-clock"></i> ${postedTime}</div>
                    </div>
                </div>
            </div>
        </a>
    `;
}

/**
 * Favori butonlarına event listener ekle
 */
function attachFavoriteListeners() {
    // Support both dedicated favorite buttons and inline heart icons inside listing-image
    const favoriteTargets = document.querySelectorAll('.favorite-button, .listing-image > .fa-heart');

    favoriteTargets.forEach(btn => {
        // Click event handler
        const handleFavoriteToggle = async function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Diğer event'leri durdur

            const listingId = this.dataset.listingId || this.closest('.listing-card')?.dataset.listingId;
            const icon = this.matches('.favorite-button') ? this.querySelector('i') : this;
            const isFav = icon.classList.contains('fas');

            try {
                if (isFav) {
                    await removeFromFavorites(listingId);
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                    if (typeof showNotification === 'function') {
                        showNotification('Favorilerden çıkarıldı', 'info');
                    }
                } else {
                    await addToFavorites(listingId);
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                    if (typeof showNotification === 'function') {
                        showNotification('Favorilere eklendi', 'success');
                    }
                }
            } catch (error) {
                console.error('Favori işlemi hatası:', error);
                if (error.message.includes('girişi gerekli')) {
                    if (typeof showNotification === 'function') {
                        showNotification('Favori eklemek için giriş yapın', 'warning');
                    } else if (typeof showInlineToast === 'function') {
                        showInlineToast('Favori eklemek için giriş yapın', 'warning');
                    } else {
                        console.warn('Favori eklemek için giriş yapın');
                    }
                    window.location.href = 'login.html';
                }
            }
        };

        // Mobile için touchstart, desktop için click
        btn.addEventListener('touchstart', handleFavoriteToggle.bind(btn), { passive: false });
        btn.addEventListener('click', handleFavoriteToggle.bind(btn));
    });
}

// Kart tıklamasını detay sayfasına yönlendir
function attachCardClickListeners() {
    document.querySelectorAll('.listing-card').forEach(card => {
        card.style.cursor = 'pointer';
        
        const handleCardClick = function(e) {
            // Favorite button veya message button'a tıklanmışsa card'ı açma
            if (e.target.closest('.favorite-button')) {
                e.stopPropagation();
                return;
            }
            if (e.target.closest('.message-button')) {
                e.stopPropagation();
                return;
            }
            
            const listingId = normalizeId(this.dataset.listingId);
            const href = this.dataset.href || (listingId ? `ilan-detay.html?id=${listingId}` : '');
            if (!listingId || !href) {
                console.warn('Kart tıklaması engellendi: geçersiz ID', this.dataset);
                if (typeof showNotification === 'function') {
                    showNotification('İlan bağlantısı eksik. Lütfen sayfayı yenileyin.', 'warning');
                } else if (typeof showInlineToast === 'function') {
                    showInlineToast('İlan bağlantısı eksik. Lütfen sayfayı yenileyin.', 'warning');
                } else {
                    console.warn('İlan bağlantısı eksik. Lütfen sayfayı yenileyin.');
                }
                return;
            }
            window.location.href = href;
        };
        
        card.addEventListener('click', handleCardClick);
        // Mobile için touchstart da ekle (ama sadece card'ın kendisi için)
        card.addEventListener('touchstart', function(e) {
            // Eğer favorite button alanına dokunulduysa, card event'ini engelle
            if (e.target.closest('.favorite-button')) {
                e.stopPropagation();
            }
        }, { passive: true });
    });
}

// Mesaj butonlarına yönlendirme bağla
function attachMessageButtonListeners() {
    document.querySelectorAll('.listing-card .message-button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const card = e.currentTarget.closest('.listing-card');
            if (!card) return;
            
            // Kullanıcı giriş yapmış mı kontrol et
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (typeof showNotification === 'function') {
                    showNotification('Mesaj göndermek için giriş yapmalısınız', 'warning');
                } else if (typeof showInlineToast === 'function') {
                    showInlineToast('Mesaj göndermek için giriş yapmalısınız', 'warning');
                } else {
                    console.warn('Mesaj göndermek için giriş yapmalısınız');
                }
                window.location.href = 'login.html';
                return;
            }
            
            const listingId = normalizeId(card.getAttribute('data-listing-id'));
            const sellerId = card.getAttribute('data-seller-id') || '';
            
            if (!listingId) {
                if (typeof showNotification === 'function') {
                    showNotification('İlan bilgisi eksik', 'error');
                } else if (typeof showInlineToast === 'function') {
                    showInlineToast('İlan bilgisi eksik', 'error');
                } else {
                    console.error('İlan bilgisi eksik');
                }
                return;
            }
            
            // Kendi ilanına mesaj yazmaya çalışıyor mu?
            if (user.id === sellerId) {
                if (typeof showNotification === 'function') {
                    showNotification('Kendi ilanınıza mesaj gönderemezsiniz', 'warning');
                } else if (typeof showInlineToast === 'function') {
                    showInlineToast('Kendi ilanınıza mesaj gönderemezsiniz', 'warning');
                } else {
                    console.warn('Kendi ilanınıza mesaj gönderemezsiniz');
                }
                return;
            }
            
            const url = `mesajlar.html?listing_id=${encodeURIComponent(listingId)}${sellerId ? `&seller_id=${encodeURIComponent(sellerId)}` : ''}`;
            window.location.href = url;
        });
    });
}

// Hover'da ikinci fotoğrafı önizle
function attachHoverGalleryPreview() {
    document.querySelectorAll('.listing-card .listing-image img[data-hover-src]').forEach(img => {
        const hoverSrc = img.getAttribute('data-hover-src');
        let originalSrc = img.getAttribute('src');
        img.addEventListener('mouseenter', () => {
            originalSrc = img.getAttribute('src');
            if (hoverSrc) img.setAttribute('src', hoverSrc);
        });
        img.addEventListener('mouseleave', () => {
            if (originalSrc) img.setAttribute('src', originalSrc);
        });
    });
}

// Kart hover'ında detay ön getirme
function attachPrefetchOnHover() {
    document.querySelectorAll('.listing-card').forEach(card => {
        let prefetched = false;
        card.addEventListener('mouseenter', async () => {
            if (prefetched) return;
            const id = card.getAttribute('data-listing-id');
            try { await getListing(id); prefetched = true; } catch (e) { /* sessiz */ }
        }, { once: false });
    });
}

/**
 * Tarihi formatla
 */
function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `<span class="date-top">${day}/${month}</span> <span class="date-bottom">${year}</span>`;
}

/**
 * HTML escape (XSS koruması)
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Load more butonunu başlat
 */
function initLoadMoreButton() {
    const loadMoreBtn = document.querySelector('.load-more-btn');
    if (!loadMoreBtn) {
        console.warn('Load more butonu bulunamadı!');
        return;
    }

    loadMoreBtn.addEventListener('click', async () => {
        if (isLoading || !hasMore) return;
        
        // Butonu loading durumuna getir
        const loadText = loadMoreBtn.querySelector('.load-more-text');
        const loadingText = loadMoreBtn.querySelector('.loading-text');
        
        if (loadText) loadText.style.display = 'none';
        if (loadingText) loadingText.style.display = 'inline';
        loadMoreBtn.disabled = true;

        // Daha fazla ilan yükle
        await loadListings(false);

        // Butonu normal duruma getir
        if (loadText) loadText.style.display = 'inline';
        if (loadingText) loadingText.style.display = 'none';
        loadMoreBtn.disabled = false;
    });
}

/**
 * IntersectionObserver ile sonsuz kaydırma (infinite scroll)
 * Load-more tıklamasını korur, görünür olunca otomatik yükler
 */
function initInfiniteScroll() {
    const loadMoreContainer = document.querySelector('.load-more-container');
    if (!loadMoreContainer || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(async (entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                if (!isLoading && hasMore) {
                    await loadListings(false);
                }
            }
        }
    }, {
        root: null,
        rootMargin: '400px 0px',
        threshold: 0.01
    });

    observer.observe(loadMoreContainer);
}

/**
 * Load more butonunun görünürlüğünü güncelle
 */
function updateLoadMoreButton() {
    const loadMoreContainer = document.querySelector('.load-more-container');
    if (!loadMoreContainer) {
        console.warn('Load more container bulunamadı!');
        return;
    }

    if (hasMore) {
        loadMoreContainer.style.display = 'flex';
        console.log('Load more butonu gösteriliyor. currentOffset:', currentOffset, 'hasMore:', hasMore);
    } else {
        loadMoreContainer.style.display = 'none';
        console.log('Load more butonu gizleniyor (tüm ilanlar yüklendi)');
    }
}

/**
 * Kategoriye göre ilanları filtrele
 * @param {Object} options - Filtreleme seçenekleri
 */
window.filterListings = async function(options = {}) {
    console.log('Kategori filtresi:', options);

    const categoryNames = Array.isArray(options.categories) && options.categories.length > 0
        ? options.categories.filter(Boolean)
        : (options.category ? [options.category] : []);

    // Offset sıfırla ve yeniden yükle
    currentOffset = 0;
    hasMore = true;
    currentFilters = { ...options, categories: categoryNames };
    
    // SADECE BU KISMI BÖYLE YAP:
    await loadListings(true, {
        category: categoryNames[0] // Bilgisayara doğrudan "bu kategoriyi getir" diyoruz
    });
};

/**
 * Başlık güncelle - kategori seçildiğinde
 */
function updateSectionTitle(categoryInput) {
    const sectionTitle = document.querySelector('.featured-listings h2');
    if (!sectionTitle) return;

    if (!categoryInput) {
        sectionTitle.textContent = 'Vitrin İlanları';
        return;
    }

    // Input slug veya obje olabilir
    let catName = categoryInput;
    if (typeof categoryInput === 'object' && categoryInput.name) {
        catName = categoryInput.name;
    } else if (typeof categoryInput === 'string') {
        const cat = getCategoryBySlug(categoryInput);
        if (cat) catName = cat.name;
    }

    // Capitalize first letter
    catName = String(catName).charAt(0).toUpperCase() + String(catName).slice(1);
    sectionTitle.textContent = catName;
    console.log('📝 Section title updated to:', catName);
}

// Başlık sıfırla - filtresiz duruma dön
window.resetSectionTitle = function() {
    const sectionTitle = document.querySelector('.featured-listings h2');
    if (sectionTitle) {
        sectionTitle.textContent = 'Vitrin İlanları';
    }
};

// Global fonksiyon olarak dışa aktar
window.loadListings = loadListings;

// Arama/filtreleme sonrası yeniden bağlamak için özel olay dinle
document.addEventListener('listingsRendered', () => {
    attachFavoriteListeners();
    attachCardClickListeners();
    attachMessageButtonListeners();
    attachHoverGalleryPreview();
    attachPrefetchOnHover();
});

// Export functions
export { loadListings, createListingCard, escapeHtml };

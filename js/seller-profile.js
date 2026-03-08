/**
 * Satıcı Profil Modülü
 * Satıcı bilgilerini, ilanlarını ve yorumlarını yönetir
 */

import { sanitizeHTML, sanitizeText } from './xss-protection.js';
import { showLoading, hideLoading } from './loading.js';

export async function initSellerProfile(supabase, sellerId) {
    try {
        showLoading('Satıcı profili yükleniyor...');
        
        // Satıcı bilgilerini ve istatistiklerini yükle
        await loadSellerInfo(supabase, sellerId);
        
        // İlanları yükle
        await loadSellerListings(supabase, sellerId);
        
        // Yorumları yükle
        await loadSellerReviews(supabase, sellerId);
        
        // Sekme değiştirme işlevini başlat
        initTabs();
        
        // Buton event listener'larını başlat
        initActionButtons(supabase, sellerId);
        
        hideLoading();
        
    } catch (error) {
        console.error('Satıcı profili yükleme hatası:', error);
        hideLoading();
        showError(`Satıcı profili yüklenirken bir hata oluştu: ${error.message}`);
    }
}

/**
 * Satıcı bilgilerini yükle
 */
async function loadSellerInfo(supabase, sellerId) {
    try {
        // Supabase auth'tan veya profiles tablosundan satıcı bilgilerini çek
        // Tüm alanları al, var olan alanlar kullanılacak
        const { data: seller, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sellerId)
            .single();

        if (error) {
            console.error('Profil sorgusu hatası:', error);
            throw error;
        }
        if (!seller) throw new Error('Satıcı bulunamadı');

        console.log('Satıcı profili verisi:', seller);

        // Satıcı bilgilerini göster
        updateSellerHeader(seller);
        
        // İstatistikleri hesapla
        await updateSellerStats(supabase, sellerId);

    } catch (error) {
        console.error('Satıcı bilgisi yükleme hatası:', error);
        throw error;
    }
}

/**
 * Satıcı başlık bölümünü güncelle
 */
function updateSellerHeader(seller) {
    // Satıcı adı: full_name'i kullan veya profil ID'sinden türet
    let displayName = 'Anonim Satıcı';
    
    if (seller.full_name && seller.full_name.trim()) {
        displayName = seller.full_name;
    } else if (seller.id) {
        // ID'nin ilk 8 karakterini kullan
        displayName = `Satıcı-${seller.id.substring(0, 8)}`;
    }
    
    document.getElementById('seller-display-name').textContent = displayName;
    
    if (seller.avatar_url) {
        const avatarImg = document.getElementById('seller-avatar-large');
        if (avatarImg) {
            avatarImg.src = seller.avatar_url;
            // 🟢 YENİ: Büyütme özelliği için stil ve event
            avatarImg.style.cursor = 'pointer';
            avatarImg.setAttribute('title', 'Büyütmek için tıklayın');
            
            // Event listener'ı temizle ve yeniden ekle (tekrar çağrılırsa diye)
            const newAvatar = avatarImg.cloneNode(true);
            avatarImg.parentNode.replaceChild(newAvatar, avatarImg);
            
            newAvatar.addEventListener('click', () => {
                openLightbox(seller.avatar_url);
            });
        }
    }

    // Doğrulanmış rozeti
    if (seller.is_verified) {
        document.getElementById('seller-verified-check').style.display = 'inline-flex';
    }

    // Üyelik tarihi
    if (seller.created_at) {
        const joinDate = new Date(seller.created_at);
        const now = new Date();
        const diffMonths = (now.getFullYear() - joinDate.getFullYear()) * 12 + 
                          (now.getMonth() - joinDate.getMonth());

        let statusBadge = 'new-member';
        let statusText = 'Yeni Üye';

        if (diffMonths > 6) {
            statusBadge = 'trusted';
            statusText = 'Güvenilir Satıcı';
        } else if (diffMonths > 3) {
            statusBadge = 'active';
            statusText = 'Aktif Satıcı';
        }

        const badge = document.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge ${statusBadge}`;
            badge.textContent = statusText;
        }

        const monthText = diffMonths === 0 ? 'Bu ay' : `${diffMonths} ay önce`;
        const memberSince = document.getElementById('seller-member-since');
        if (memberSince) {
            memberSince.textContent = `Üyelik: ${monthText}`;
        }
    }
}

/**
 * Satıcı istatistiklerini hesapla ve göster
 */
async function updateSellerStats(supabase, sellerId) {
    try {
        // Aktif ilanlar
        const { data: activeAds = [], error: activeError } = await supabase
            .from('listings')
            .select('id', { count: 'exact' })
            .eq('user_id', sellerId)
            .eq('status', 'active');

        // Satılmış ilanlar
        const { data: soldAds = [], error: soldError } = await supabase
            .from('listings')
            .select('id', { count: 'exact' })
            .eq('user_id', sellerId)
            .eq('status', 'sold');

        // İstatistikleri göster
        if (!activeError && activeAds) {
            document.getElementById('stat-active-ads').textContent = activeAds.length || 0;
        }

        if (!soldError && soldAds) {
            document.getElementById('stat-sold-ads').textContent = soldAds.length || 0;
        }

        // Yanıt oranı (Placeholder) - Gerekirse db'den çekilebilir
        // const responseRate = ...

    } catch (error) {
        console.error('İstatistik hesaplaması hatası:', error);
    }
}

/**
 * Satıcının ilanlarını yükle
 */
async function loadSellerListings(supabase, sellerId) {
    try {
        console.log('Satıcı ID ile ilanlar yükleniyor:', sellerId);
        
        const { data: listings = [], error } = await supabase
            .from('listings')
            .select('*')
            .eq('user_id', sellerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('İlanlar sorgusu hatası:', error);
            
            // Tüm ilanları çekmeyi dene (debug amaçlı)
            const { data: allListings = [], error: allError } = await supabase
                .from('listings')
                .select('*')
                .limit(1);
            
            console.log('Debug - Sample listing:', JSON.stringify(allListings[0], null, 2));
            console.log('Debug - All listings error:', allError);
            
            renderListings('active-listings', []);
            renderListings('sold-listings', []);
            return;
        }

        console.log('Yüklenen ilanlar sayısı:', listings.length, 'İlanlar:', listings);
        
        // Aktif ve satılmış ilanları ayır
        const activeListing = listings.filter(l => l.status === 'active');
        const soldListings = listings.filter(l => l.status === 'sold');

        // Toplam ilan sayısını göster
        const totalListings = listings.length;
        const totalListingsText = document.getElementById('total-listings-text');
        if (totalListingsText) {
            totalListingsText.textContent = totalListings;
        }

        // Aktif ilanları göster
        renderListings('active-listings', activeListing);

        // Satılmış ilanları göster
        renderListings('sold-listings', soldListings);

    } catch (error) {
        console.error('İlanlar yükleme hatası:', error);
        renderListings('active-listings', []);
        renderListings('sold-listings', []);
    }
}

/**
 * İlanları render et - Grid ve List görünümünü destekler
 */
function renderListings(containerId, listings) {
    if (!listings || listings.length === 0) {
        // Grid görünümü temizle
        const gridContainer = document.getElementById(containerId);
        if (gridContainer) {
            gridContainer.innerHTML = '<div class="loading-placeholder">İlan bulunamadı</div>';
        }
        
        // Tablo görünümünü temizle
        const tableId = containerId + '-table';
        const tableContainer = document.getElementById(tableId);
        if (tableContainer) {
            const tableBody = document.getElementById(containerId + '-list');
            if (tableBody) {
                tableBody.innerHTML = '<div class="loading-placeholder">İlan bulunamadı</div>';
            }
        }
        return;
    }

    // Grid görünümü HTML'i
    const gridHtml = listings.map(listing => {
        const isActive = listing.status === 'active';
        const statusText = isActive ? 'Aktif' : 'Satıldı';
        const statusClass = isActive ? 'active' : 'sold';
        // image_url veya photos[0] kontrolü
        const photos = Array.isArray(listing.photos) ? listing.photos : [];
        const imageUrl = photos.length > 0 ? photos[0] : (listing.image_url && typeof listing.image_url === 'string' && listing.image_url.trim() ? listing.image_url : null);

        return `
            <a href="/ilan-detay.html?id=${listing.id}" class="listing-card">
                ${imageUrl 
                    ? `<img data-src="${imageUrl}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${listing.title}" class="listing-image lazy-blur">` 
                    : `<div class="listing-image" style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 0.875rem; font-weight: 500;">Resim Yok</div>`}
                <div class="listing-info">
                    <h3 class="listing-title">${listing.title || 'Başlıksız İlan'}</h3>
                    <div class="listing-meta">
                        <span class="listing-status ${statusClass}" data-status="${statusClass}">${statusText}</span>
                        <span>${formatDate(listing.created_at)}</span>
                    </div>
                    <div class="listing-price">${formatPrice(listing.price)}</div>
                </div>
            </a>
        `;
    }).join('');

    // Grid container'ı güncelle
    const gridContainer = document.getElementById(containerId);
    if (gridContainer) {
        gridContainer.innerHTML = gridHtml;
    }
    
    // Tablo görünümü HTML'i
    const tableHtml = listings.map(listing => {
        const isActive = listing.status === 'active';
        const statusText = isActive ? 'Aktif' : 'Satıldı';
        const statusClass = isActive ? 'active' : 'sold';
        
        const photos = Array.isArray(listing.photos) ? listing.photos : [];
        const imageUrl = photos.length > 0 ? photos[0] : (listing.image_url && typeof listing.image_url === 'string' && listing.image_url.trim() ? listing.image_url : null);

        return `
            <div class="table-row" data-status="${statusClass}">
                <div class="col-image">
                    ${imageUrl 
                        ? `<img data-src="${imageUrl}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${listing.title}" class="lazy-blur">` 
                        : `<div style="width: 100%; height: 75px; background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 0.75rem; font-weight: 500;">Resim Yok</div>`}
                </div>
                <div class="col-title">
                    <a href="/ilan-detay.html?id=${listing.id}" class="col-title">${listing.title || 'Başlıksız İlan'}</a>
                </div>
                <div class="col-price">${formatPrice(listing.price)}</div>
                <div class="col-date">${formatDate(listing.created_at)}</div>
            </div>
        `;
    }).join('');
    // Tablo container'ı güncelle
    const tableId = containerId + '-table';
    const tableListId = containerId + '-list';
    const tableListContainer = document.getElementById(tableListId);
    if (tableListContainer) {
        tableListContainer.innerHTML = tableHtml;
    }
    
    // Lazy loading'i başlat
    if (window.initLazyLoading) {
        setTimeout(() => window.initLazyLoading(), 100);
    }
}

/**
 * İlanları tablo formatında render et
 */
function renderListingsTable(tableBodyId, listings) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;
    
    if (!listings || listings.length === 0) {
        tableBody.innerHTML = '<div class="loading-placeholder" style="grid-column: 1 / -1;">İlan bulunamadı</div>';
        return;
    }

    const html = listings.map(listing => {
        const isActive = listing.status === 'active';
        const statusClass = isActive ? 'active' : 'sold';
        
        const photos = Array.isArray(listing.photos) ? listing.photos : [];
        const imageUrl = photos.length > 0 ? photos[0] : (listing.image_url || 'https://via.placeholder.com/100x75');

        return `
            <div class="table-row">
                <div class="col-image">
                    <img src="${imageUrl}" 
                         alt="${listing.title}">
                </div>
                <div class="col-title">
                    <a href="/ilan-detay.html?id=${listing.id}" class="col-title">${listing.title || 'Başlıksız'}</a>
                </div>
                <div class="col-price">${formatPrice(listing.price)}</div>
                <div class="col-date" data-status="${statusClass}">${formatDate(listing.created_at)}</div>
            </div>
        `;
    }).join('');

    tableBody.innerHTML = html;
}

/**
 * Satıcının yorumlarını yükle
 */
async function loadSellerReviews(supabase, sellerId) {
    try {
        // Yorumları bulmaya çalış - seller_ratings tablosunu kullan
        const { data: reviews = [], error } = await supabase
            .from('seller_ratings')
            .select('*')
            .eq('seller_id', sellerId)
            .eq('is_approved', true) // Sadece onaylanmışları göster
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Yorumlar sorgusu hatası:', error);
            document.getElementById('review-count').textContent = '0';
            renderReviews([]);
            return;
        }

        // Değerlendirenlerin isimlerini çek
        if (reviews.length > 0) {
            const buyerIds = [...new Set(reviews.map(r => r.buyer_id))];
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', buyerIds);

            // İsimleri eşleştir
            if (profiles) {
                reviews.forEach(review => {
                    const profile = profiles.find(p => p.id === review.buyer_id);
                    review.profiles = { full_name: profile?.full_name || 'Müşteri' };
                });
            }
        }

        document.getElementById('review-count').textContent = reviews.length || 0;
        renderReviews(reviews);
    } catch (error) {
        console.error('Yorumlar yüklenirken hata:', error);
        document.getElementById('review-count').textContent = '0';
        renderReviews([]);
    }
}

/**
 * Yorumları render et
 */
function renderReviews(reviews) {
    const container = document.getElementById('reviews-list');
    if (!container) return;
    
    if (!reviews || reviews.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">Henüz yorum yok</div>';
        return;
    }

    const html = reviews.map(review => {
        const stars = Array(Math.min(review.rating || 5, 5))
            .fill('<i class="fas fa-star"></i>')
            .join('');

        const reviewerName = review.profiles?.full_name || 'Müşteri';

        return `
            <div class="review-item">
                <div class="review-header">
                    <span class="reviewer-name">${sanitizeText(reviewerName)}</span>
                    <div class="review-rating">${stars}</div>
                </div>
                <p class="review-text">${sanitizeHTML(review.comment || 'Yorum metni yok')}</p>
                <span class="review-date">${formatDate(review.created_at)}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Sekme değiştirme işlevini başlat - Yeni yapı için güncellendi
 */
function initTabs() {
    const mainTabs = document.querySelectorAll('[data-tab]');
    const subTabs = document.querySelectorAll('[data-sub-tab]');
    const viewBtns = document.querySelectorAll('[data-view]');
    
    // Ana sekmeler
    mainTabs.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Tüm tab butonlarını deaktif et
            mainTabs.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Seçili tab'ı aktif et
            button.classList.add('active');
            const tabContent = document.getElementById(`tab-${tabName}`);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
    
    // Alt sekmeler (Aktif, Satılmış)
    subTabs.forEach(button => {
        button.addEventListener('click', () => {
            const subTabName = button.dataset.subTab;
            
            // Aynı grupta diğer sekmelerini deaktif et
            document.querySelectorAll(`[data-sub-tab]`).forEach(b => {
                b.classList.remove('active');
            });
            
            // Seçili alt tab'ı aktif et
            button.classList.add('active');
            
            // Listings'i filtrele
            filterListingsByStatus(subTabName);
        });
    });
    
    // Görünüm değiştirme (Grid/List)
    viewBtns.forEach(button => {
        button.addEventListener('click', () => {
            const viewType = button.dataset.view;
            
            // Tüm view butonlarını deaktif et
            viewBtns.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            
            // Görünümü değiştir
            switchListingsView(viewType);
        });
    });
}

/**
 * İlanları duruma göre filtrele
 */
function filterListingsByStatus(status) {
    // Aktif ilanlar container'ı
    const activeGridContainer = document.getElementById('active-listings');
    const activeTableContainer = document.getElementById('active-listings-table');
    
    // Satılmış ilanlar container'ı
    const soldGridContainer = document.getElementById('sold-listings');
    const soldTableContainer = document.getElementById('sold-listings-table');
    
    if (status === 'active') {
        // Aktif ilanları göster, satılmışları gizle
        if (activeGridContainer) activeGridContainer.style.display = 'grid';
        if (activeTableContainer) activeTableContainer.style.display = 'none';
        if (soldGridContainer) soldGridContainer.style.display = 'none';
        if (soldTableContainer) soldTableContainer.style.display = 'none';
    } else if (status === 'sold') {
        // Satılmış ilanları göster, aktif olanları gizle
        if (activeGridContainer) activeGridContainer.style.display = 'none';
        if (activeTableContainer) activeTableContainer.style.display = 'none';
        if (soldGridContainer) soldGridContainer.style.display = 'grid';
        if (soldTableContainer) soldTableContainer.style.display = 'none';
    } else if (status === 'all') {
        // Tümünü göster
        if (activeGridContainer) activeGridContainer.style.display = 'grid';
        if (soldGridContainer) soldGridContainer.style.display = 'grid';
    }
}

/**
 * İlanlar görünümünü değiştir (Grid/List)
 */
function switchListingsView(viewType) {
    // Aktif ilanlar
    const activeGridContainer = document.getElementById('active-listings');
    const activeTableContainer = document.getElementById('active-listings-table');
    
    // Satılmış ilanlar
    const soldGridContainer = document.getElementById('sold-listings');
    const soldTableContainer = document.getElementById('sold-listings-table');
    
    if (viewType === 'grid') {
        if (activeGridContainer) activeGridContainer.style.display = 'grid';
        if (activeTableContainer) activeTableContainer.style.display = 'none';
        if (soldGridContainer) soldGridContainer.style.display = 'grid';
        if (soldTableContainer) soldTableContainer.style.display = 'none';
    } else if (viewType === 'list') {
        if (activeGridContainer) activeGridContainer.style.display = 'none';
        if (activeTableContainer) activeTableContainer.style.display = '';
        if (soldGridContainer) soldGridContainer.style.display = 'none';
        if (soldTableContainer) soldTableContainer.style.display = '';
    }
}

/**
 * Yardımcı fonksiyonlar
 */
function formatPrice(price) {
    if (!price) return '-';
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY'
    }).format(price);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    if (diffDays < 30) return `${diffDays} gün önce`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
    return `${Math.floor(diffDays / 365)} yıl önce`;
}

function showError(message) {
    const main = document.querySelector('.seller-profile-main');
    if (main) {
        main.innerHTML = `
            <div style="padding: 3rem; text-align: center;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                <h2 style="margin-bottom: 0.5rem;">Hata</h2>
                <p style="color: #6b7280;">${message}</p>
                <a href="/" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #10b981; color: white; text-decoration: none; border-radius: 0.5rem;">Anasayfaya Dön</a>
            </div>
        `;
    }
}

/**
 * Action butonlarını initialize et (Telefon Göster / Mesaj Gönder)
 */
function initActionButtons(supabase, sellerId) {
    const phoneBtn = document.querySelector('.btn-contact:not(.secondary)');
    const messageBtn = document.querySelector('.btn-contact.secondary');
    
    // Telefon göster butonu
    if (phoneBtn) {
        phoneBtn.addEventListener('click', async () => {
            try {
                const { data: seller, error } = await supabase
                    .from('profiles')
                    .select('phone')
                    .eq('id', sellerId)
                    .single();
                
                if (error || !seller || !seller.phone) {
                    alert('Telefon numarası bulunamadı.');
                    return;
                }
                
                phoneBtn.innerHTML = `<i class="fas fa-phone"></i> ${seller.phone}`;
                phoneBtn.style.pointerEvents = 'none';
            } catch (error) {
                console.error('Telefon numarası çekme hatası:', error);
                alert('Telefon numarası yüklenirken hata oluştu.');
            }
        });
    }
    
    // Mesaj gönder butonu
    if (messageBtn) {
        messageBtn.addEventListener('click', () => {
            window.location.href = `/mesajlar.html?user=${sellerId}`;
        });
    }
}

/**
 * Profil fotoğrafını büyütmek için Lightbox aç
 */
function openLightbox(imageUrl) {
    if (!imageUrl) return;

    // Varsa eski lightbox'ı temizle
    const oldLightbox = document.getElementById('profile-lightbox');
    if (oldLightbox) oldLightbox.remove();

    // Lightbox oluştur
    const lightbox = document.createElement('div');
    lightbox.id = 'profile-lightbox';
    lightbox.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        opacity: 0;
        transition: opacity 0.3s ease;
        overflow: hidden;
    `;

    // İçerik
    lightbox.innerHTML = `
        <div class="lightbox-content" style="position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">
            <img id="lightbox-img" src="${imageUrl}" style="
                max-width: 90%;
                max-height: 90%;
                object-fit: contain;
                border-radius: 4px;
                cursor: grab;
                transition: transform 0.1s ease-out;
                transform-origin: center center;
            " draggable="false" alt="Profil Fotoğrafı">
            
            <button id="close-lightbox" style="
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
                z-index: 10001;
            " title="Kapat">
                <i class="fas fa-times"></i>
            </button>

            <div style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.7); font-size: 0.9rem; pointer-events: none;">
                Mouse tekerleği ile yakınlaştırın, sürükleyerek gezinin
            </div>
        </div>
    `;

    document.body.appendChild(lightbox);

    // Zoom ve Pan Değişkenleri
    const img = document.getElementById('lightbox-img');
    let scale = 1;
    let panning = false;
    let pointX = 0;
    let pointY = 0;
    let startX = 0;
    let startY = 0;

    // Zoom Fonksiyonu
    const handleWheel = (e) => {
        e.preventDefault();
        const xs = (e.clientX - pointX) / scale;
        const ys = (e.clientY - pointY) / scale;
        
        const delta = -Math.sign(e.deltaY);
        const step = 0.15; // Zoom hızı
        
        const oldScale = scale;
        
        if (delta > 0) {
            scale += step;
        } else {
            scale -= step;
        }
        
        // Sınırlar
        scale = Math.min(Math.max(1, scale), 5); // Max 5x zoom, Min 1x

        if (scale === 1) {
            pointX = 0;
            pointY = 0;
            img.style.cursor = 'grab';
        } else {
            // Fare pozisyonuna göre zoom yapma mantığı (basitleştirilmiş)
            // Detaylı matrix transform yerine basitçe büyütme kullanıyoruz şimdilik
            img.style.cursor = 'move';
        }

        updateTransform();
    };

    // Pan Başlangıcı
    const handleMouseDown = (e) => {
        if (scale > 1) {
            e.preventDefault();
            startX = e.clientX - pointX;
            startY = e.clientY - pointY;
            panning = true;
            img.style.cursor = 'grabbing';
        }
    };

    // Pan Hareketi
    const handleMouseMove = (e) => {
        if (!panning) return;
        e.preventDefault();
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        updateTransform();
    };

    // Pan Bitişi
    const handleMouseUp = () => {
        panning = false;
        if (scale > 1) img.style.cursor = 'move';
        else img.style.cursor = 'grab';
    };

    // Transform Uygula
    function updateTransform() {
        img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    }

    // Event Listeners Ekle
    lightbox.querySelector('.lightbox-content').addEventListener('wheel', handleWheel, { passive: false });
    img.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);


    // Animasyonla göster
    requestAnimationFrame(() => {
        lightbox.style.opacity = '1';
    });

    // Kapatma fonksiyonu
    const closeLightbox = () => {
        // Event listener'ları temizle
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', escListener);

        lightbox.style.opacity = '0';
        setTimeout(() => {
            if (lightbox.parentNode) lightbox.parentNode.removeChild(lightbox);
        }, 300);
    };

    // Event Listeners (Kapatma)
    lightbox.querySelector('#close-lightbox').addEventListener('click', closeLightbox);
    
    // Sadece overlay'e (resim dışına) tıklanınca kapat, sürüklerken kapanmasın
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
            closeLightbox();
        }
    });

    const escListener = (e) => {
        if (e.key === 'Escape') {
            closeLightbox();
        }
    };
}

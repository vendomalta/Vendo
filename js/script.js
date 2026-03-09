import { supabase } from './supabase.js';
import { createListing, uploadPhotos } from './api.js';
import { initializeCategories } from './category-data.js';
import { categoryRouter } from './category-router.js';

// ✅ Logger import et (production-ready notifications)
import logger from './logger.js';

// Uygulama başlangıç logu ve temel UI kurulumları
document.addEventListener('DOMContentLoaded', async () => {
    logger.debug('Verde Uygulaması Başlatıldı', 'App');

    // Kategorileri yükle
    await initializeCategories();
    // Router'ı yenile (yeni kategorilerle path'i parse et)
    categoryRouter.refresh();

    if (typeof initializeListings === 'function') initializeListings();
    if (typeof initializeSettingsNavigation === 'function') initializeSettingsNavigation();

    // FAB button event handler - mobil optimizasyonlu
    const fabButton = document.querySelector('.post-ad-fab');
    if (fabButton) {
        const handleFabClick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            window.location.href = 'ilan-ver.html';
        };

        // Mobile için touchstart, desktop için click
        fabButton.addEventListener('touchstart', handleFabClick, { passive: false });
        fabButton.addEventListener('click', handleFabClick);
    }
});

// FORM DİNLEYİCİSİNİ BELGE SEVİYESİNDE KUR: Header sonradan eklendiği için garantili çalışır
document.addEventListener('submit', async function (e) {
    const postForm = e.target;
    if (!postForm || postForm.id !== 'quickPostForm') return;

    e.preventDefault();

    const submitBtn = postForm.querySelector('.submit-ad');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }

    try {
        // 1. Kullanıcı kontrolü
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            // ✅ Alert yerine toast notification
            logger.toast('Please sign in to post an ad', 'warning');
            window.location.href = 'login.html';
            return;
        }

        // 2. Form verilerini topla
        const title = document.getElementById('adTitle')?.value.trim();
        const price = document.getElementById('adPrice')?.value;
        const currency = document.getElementById('adCurrency')?.value;
        const description = document.getElementById('adDescription')?.value.trim();
        const locationEl = document.getElementById('adLocation');
        const location = locationEl && locationEl.selectedIndex !== -1
            ? locationEl.options[locationEl.selectedIndex].text
            : 'Belirtilmedi';

        // Kategori belirleme - modal başlığından veya varsayılan
        const formTitleElement = document.getElementById('formTitle');
        let category = 'genel';

        if (formTitleElement) {
            const titleText = formTitleElement.textContent.toLowerCase();
            if (titleText.includes('emlak')) category = 'emlak';
            else if (titleText.includes('vasıta') || titleText.includes('araç')) category = 'vasita';
            else if (titleText.includes('elektronik')) category = 'elektronik';
            else if (titleText.includes('ev') && titleText.includes('eşya')) category = 'ev_esyasi';
            else if (titleText.includes('giyim')) category = 'giyim';
        }

        if (!title || !price || !description) {
            throw new Error('Please fill in all required fields!');
        }

        // 3. Dinamik alanları (extra_fields) topla
        const extraFields = {};
        const dynamicFieldsContainer = document.getElementById('dynamic-fields');
        if (dynamicFieldsContainer) {
            dynamicFieldsContainer.querySelectorAll('input, select, textarea').forEach(field => {
                // Alanın adı varsa ve değeri boş değilse JSONB'ye ekle
                if (field.name && field.value.trim() !== '') {
                    extraFields[field.name] = field.value.trim();
                }
            });
        }

        // 4. Fotoğrafları yükle
        let photoUrls = [];
        if (window.uploadedPhotos && window.uploadedPhotos.length > 0) {
            if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading photos...';
            const photoFiles = window.uploadedPhotos.map(p => p.file);
            photoUrls = await uploadPhotos(photoFiles);
            // ✅ Logger ile debug
            logger.debug('Fotoğraflar yüklendi', photoUrls);
        }

        // 5. İlanı oluştur
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating listing...';
        const listingData = {
            title,
            price,
            currency,
            description,
            location,
            category,
            photos: photoUrls,
            extraFields: extraFields // Dinamik alanları API'ye gönder
        };
        const newListing = await createListing(listingData);
        // ✅ Logger ile debug
        logger.debug('İlan oluşturuldu', newListing);

        // 6. Başarı mesajı - ✅ Toast notification kullan
        logger.success('İlanınız başarıyla yayınlandı!');

        // 7. Modalı kapat ve formu temizle
        const modal = document.getElementById('quickPostModal');
        if (modal) modal.classList.remove('active');
        postForm.reset();

        if (window.uploadedPhotos) {
            window.uploadedPhotos = [];
            const previewGrid = document.getElementById('photoPreviewGrid');
            if (previewGrid) previewGrid.innerHTML = '';
            const uploadBtn = document.querySelector('.photo-upload-btn');
            if (uploadBtn) uploadBtn.style.display = 'block';
        }

        setTimeout(() => { window.location.reload(); }, 1000);

    } catch (error) {
        // ✅ Logger ile hata işleme
        logger.error('Ad creation error', error);

        const errorMessage = error?.message || 'Unknown error';

        // Hata mesajı özelleştirme
        if (errorMessage.includes('schema cache')) {
            logger.toast('Database column error. Please check your tables in Supabase', 'error');
        } else if (errorMessage.includes('favorites_listing_id_fkey') || errorMessage.includes('profiles_updated_at')) {
            logger.toast('RLS or FOREIGN KEY Error! Check your Supabase tables', 'error');
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
});

// Mobile Header & Search Logic
// Mobile Header & Search Logic
function initializeMobileHeaderEvents() {
    // 2. Mobile Search Logic
    const searchToggleBtn = document.querySelector('.mobile-search-toggle');
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchInput = document.querySelector('.search-input');
    const searchContainer = document.querySelector('.search-bar-container');
    
    if (searchToggleBtn && searchContainer) {
        // Clone to clean listeners
        const newSearchBtn = searchToggleBtn.cloneNode(true);
        searchToggleBtn.parentNode.replaceChild(newSearchBtn, searchToggleBtn);

        newSearchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = searchContainer.classList.contains('active');
            
            if (isActive) {
                searchContainer.classList.remove('active');
                newSearchBtn.setAttribute('aria-expanded', 'false');
                newSearchBtn.classList.remove('active');
            } else {
                searchContainer.classList.add('active');
                newSearchBtn.setAttribute('aria-expanded', 'true');
                newSearchBtn.classList.add('active');
                if (searchInput) setTimeout(() => searchInput.focus(), 100);
            }
        });

        // Close search when clicking outside
        document.addEventListener('click', (e) => {
            if (searchContainer.classList.contains('active') && 
                !searchContainer.contains(e.target) && 
                !newSearchBtn.contains(e.target)) {
                searchContainer.classList.remove('active');
                newSearchBtn.setAttribute('aria-expanded', 'false');
                newSearchBtn.classList.remove('active');
            }
        });
    }

    if (searchWrapper && searchInput) {
        // Optional: Add visual focus state enhancement if needed
        searchInput.addEventListener('focus', () => {
            searchWrapper.classList.add('focused');
        });
        searchInput.addEventListener('blur', () => {
            searchWrapper.classList.remove('focused');
        });

    }

    // 3. Mobile Notification Logic
    const notifToggleBtn = document.querySelector('.mobile-notification-toggle');
    const notifDropdown = document.querySelector('#mobileNotificationDropdown');

    if (notifToggleBtn && notifDropdown) {
        // Clone to clean listeners
        const newNotifBtn = notifToggleBtn.cloneNode(true);
        notifToggleBtn.parentNode.replaceChild(newNotifBtn, notifToggleBtn);

        newNotifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault(); // Prevent default anchor behavior if any
            
            const isActive = notifDropdown.classList.contains('active');

            if (isActive) {
                notifDropdown.classList.remove('active');
                newNotifBtn.setAttribute('aria-expanded', 'false');
            } else {
                // Close other dropdowns/menus if open
                if (searchContainer) searchContainer.classList.remove('active');
                
                notifDropdown.classList.add('active');
                newNotifBtn.setAttribute('aria-expanded', 'true');
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (notifDropdown.classList.contains('active') &&
                !notifDropdown.contains(e.target) &&
                !newNotifBtn.contains(e.target)) {
                notifDropdown.classList.remove('active');
                newNotifBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

// Initialize on headerLoaded to ensure elements exist
document.addEventListener('headerLoaded', initializeMobileHeaderEvents);
// Also try on DOMContentLoaded in case header is static
document.addEventListener('DOMContentLoaded', initializeMobileHeaderEvents);
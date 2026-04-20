/**
 * Live Preview Functionality for Ad Posting Form
 * Updates the preview card in real-time as user types
 */

document.addEventListener('DOMContentLoaded', () => {
    const inputs = {
        title: document.getElementById('title'),
        price: document.getElementById('price'),
        currency: document.getElementById('currency'),
        city: document.getElementById('city'), // Assuming there's a city input or select
        district: document.getElementById('district'), // Assuming there's a district input or select
        category: document.getElementById('category-select') // Or however category is selected
    };

    const preview = {
        title: document.getElementById('previewTitle'),
        price: document.getElementById('previewPrice'),
        location: document.getElementById('previewLocation'),
        category: document.getElementById('previewCategory'),
        image: document.getElementById('previewImage'),
        imageCount: document.getElementById('previewImageCount'),
        badge: document.getElementById('previewBadge')
    };

    // Helper to format price
    const formatPrice = (price, currency = '€') => {
        if (!price) return `${currency}0`;
        return `${currency}${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(price)}`;
    };

    // Event Listeners
    if (inputs.title && preview.title) {
        inputs.title.addEventListener('input', (e) => {
            preview.title.textContent = e.target.value.trim() || 'İlan Başlığı';
        });
    }

    if (inputs.price && preview.price) {
        inputs.price.addEventListener('input', (e) => {
            const currency = inputs.currency ? inputs.currency.value : '€';
            preview.price.textContent = formatPrice(e.target.value, currency);
        });
    }

    if (inputs.currency && preview.price) {
        inputs.currency.addEventListener('change', (e) => {
            const price = inputs.price ? inputs.price.value : 0;
            preview.price.textContent = formatPrice(price, e.target.value);
        });
    }

    // Location update logic
    const updateLocation = () => {
        if (!preview.location) return;
        
        const city = inputs.city ? (inputs.city.options ? inputs.city.options[inputs.city.selectedIndex].text : inputs.city.value) : '';
        const districtInput = document.getElementById('district'); 
        const district = districtInput ? (districtInput.options ? districtInput.options[districtInput.selectedIndex].text : districtInput.value) : '';
        
        let locationText = 'Şehir seçiniz';
        if (city && district && district !== 'İlçe seçin...') {
            locationText = `${city}, ${district}`;
        } else if (city && city !== 'Şehir seçin...') {
             locationText = city;
        }
        
        preview.location.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${locationText}`;
    };

    if (inputs.city) inputs.city.addEventListener('change', updateLocation);
    // If district input exists or is added later, this might need dynamic binding, but for now:
    const districtInput = document.getElementById('district');
    if (districtInput) districtInput.addEventListener('change', updateLocation);

    // Global function to update preview image
    window.updatePreviewImage = (url, count) => {
        if (url && preview.image) {
            preview.image.src = url;
            preview.image.style.objectFit = 'cover';
        } else if (preview.image) {
             // Reset to placeholder
             preview.image.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23e2e8f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' fill='%2394a3b8' text-anchor='middle' font-family='sans-serif'%3EFotoğraf Yok%3C/text%3E%3C/svg%3E";
        }
        
        if (count !== undefined && preview.imageCount) {
             preview.imageCount.textContent = count;
             preview.imageCount.parentElement.style.display = count > 0 ? 'flex' : 'none';
        }
    };
    
    // Listen for category updates via MutationObserver since ilan-ver-form.js updates the DOM directly
    const categoryTitleEl = document.getElementById('categoryTitle');
    if (categoryTitleEl && preview.category) {
        // Initial set
        if (categoryTitleEl.textContent) {
            preview.category.textContent = categoryTitleEl.textContent;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    if (preview.category) preview.category.textContent = categoryTitleEl.textContent;
                }
            });
        });

        observer.observe(categoryTitleEl, { childList: true, characterData: true, subtree: true });
    }

    // --- DYNAMIC FIELDS OBSERVER (STEP 2) ---
    const step2Container = document.getElementById('categorySpecificFields');
    if (step2Container) {
        step2Container.addEventListener('input', (e) => {
            const input = e.target;
            if (input.name === 'marka' || input.name === 'brand') {
                 // We could show brand in title if we want, but usually it's just in the details.
            }
        });
    }

    // Also listen for custom event if we decide to add it later
    window.addEventListener('categoryChanged', (e) => {
         if (e.detail && e.detail.categoryName) {
             if (preview.category) preview.category.textContent = e.detail.categoryName;
         }
    });

    // Initialize with current values
    if (inputs.city) inputs.city.dispatchEvent(new Event('change'));
    if (inputs.title && preview.title) preview.title.textContent = inputs.title.value || 'İlan Başlığı';
    if (inputs.price && preview.price) {
        const currency = inputs.currency ? inputs.currency.value : '€';
        preview.price.textContent = formatPrice(inputs.price.value, currency);
    }

    // ==========================================
    // DRAG & CROP FUNCTIONALITY FOR COVER PHOTO
    // ==========================================
    const imgElement = preview.image;
    const imgContainer = document.getElementById('previewImageContainer'); // Using container for class toggle
    const blurBg = document.getElementById('previewBlurBg');
    const fitBtn = document.getElementById('fitToggleBtn');
    
    let isDragging = false;
    let startX, startY;
    let initialObjectPositionX = 50; // Default %
    let initialObjectPositionY = 50; // Default %
    let isFitMode = false;

    // Toggle Fit Mode
    if (fitBtn) {
        fitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Don't trigger upload input
            
            isFitMode = !isFitMode;
            
            // UI Updates
            if (isFitMode) {
                fitBtn.classList.add('active');
                imgContainer.classList.add('fit-mode');
                fitBtn.innerHTML = '<i class="fas fa-compress"></i>'; // Icon change
                
                // Set blur bg source if image exists
                if (imgElement.src && !imgElement.src.includes('svg')) {
                    blurBg.style.backgroundImage = `url(${imgElement.src})`;
                }
            } else {
                fitBtn.classList.remove('active');
                imgContainer.classList.remove('fit-mode');
                fitBtn.innerHTML = '<i class="fas fa-expand"></i>';
                
                // Reset blur bg
                blurBg.style.backgroundImage = 'none';
            }
            
            // Re-render crop
            await performCrop();
        });
    }

    imgElement.addEventListener('dragstart', (e) => e.preventDefault()); // Prevent native drag

    imgElement.addEventListener('mousedown', (e) => {
        // Only allow drag if NOT in fit mode and image exists
        if (isFitMode || !window.uploadedPhotos || window.uploadedPhotos.length === 0) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        imgElement.style.transition = 'none'; // Turn off transition for drag

        // Get current object-position
        const style = window.getComputedStyle(imgElement);
        const objectPosition = style.objectPosition.split(' ');
        
        initialObjectPositionX = parseFloat(objectPosition[0]) || 50;
        initialObjectPositionY = parseFloat(objectPosition[1]) || 50;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const w = imgElement.offsetWidth;
        const h = imgElement.offsetHeight;
        const naturalW = imgElement.naturalWidth;
        const naturalH = imgElement.naturalHeight;

        // Container aspect ratio vs Image aspect ratio
        const containerRatio = w / h;
        const imageRatio = naturalW / naturalH;

        let deltaXPercent = 0;
        let deltaYPercent = 0;
        
        const SENSITIVITY = 0.5;

        if (imageRatio > containerRatio) {
             // Landscape - drag X
             const deltaX = e.clientX - startX;
             deltaXPercent = (deltaX / w) * 100 * SENSITIVITY; 
             
             let newX = initialObjectPositionX - deltaXPercent;
             newX = Math.max(0, Math.min(100, newX));
             imgElement.style.objectPosition = `${newX}% ${initialObjectPositionY}%`;
        } else {
             // Portrait - drag Y
             const deltaY = e.clientY - startY;
             deltaYPercent = (deltaY / h) * 100 * SENSITIVITY;
             
             let newY = initialObjectPositionY - deltaYPercent;
             newY = Math.max(0, Math.min(100, newY));
             imgElement.style.objectPosition = `${initialObjectPositionX}% ${newY}%`;
        }
    });

    document.addEventListener('mouseup', async (e) => {
        if (!isDragging) return;
        isDragging = false;
        imgElement.style.transition = 'object-position 0.1s'; // Restore transition

        // Perform crop
        await performCrop();
    });

    // Helper to update Blur BG when image changes
    window.updatePreviewBlur = (url) => {
        if (blurBg && isFitMode) {
             blurBg.style.backgroundImage = `url(${url})`;
        }
    };
    
    // Hook into global update
    const originalUpdatePreview = window.updatePreviewImage;
    window.updatePreviewImage = (url, count) => {
        if (originalUpdatePreview) originalUpdatePreview(url, count);
        if (url && blurBg && isFitMode) {
            blurBg.style.backgroundImage = `url(${url})`;
        }
    };

    async function performCrop() {
        if (!window.uploadedPhotos || window.uploadedPhotos.length === 0) return;
        
        const photoData = window.uploadedPhotos[0];
        const sourceFile = photoData.originalFile || photoData.file; // Always use original if available
        
        if (!sourceFile) return;

        const bitmap = await createImageBitmap(sourceFile);
        
        // Preview card dimensions for aspect ratio
        const containerW = imgElement.offsetWidth || 300; // Fallback
        const containerH = imgElement.offsetHeight || 225;
        const containerRatio = containerW / containerH;
        
        // Canvas setup
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = canvas.width / containerRatio;
        const ctx = canvas.getContext('2d');
        
        // Logic split based on Fit Mode
        if (isFitMode) {
            // ==================
            // FIT / CONTAIN MODE
            // ==================
            
            // 1. Draw Blurred Background
            // Scale image to cover canvas exactly
            const { width: iw, height: ih } = bitmap;
            let bgW, bgH, bgX, bgY;
            
            // Cover logic for background
            if (iw / ih > containerRatio) {
                bgH = ih;
                bgW = ih * containerRatio;
                bgX = (iw - bgW) / 2; // Center crop
                bgY = 0;
            } else {
                bgW = iw;
                bgH = iw / containerRatio;
                bgY = (ih - bgH) / 2; // Center crop
                bgX = 0;
            }
            
            // Draw bg
            ctx.filter = 'blur(20px) brightness(0.8)';
            // Note: filter support in canvas context might vary, but widely supported now.
            // Alternative: draw small and scale up.
            
            // Drawing the center-cropped part of image to cover full canvas
            ctx.drawImage(bitmap, bgX, bgY, bgW, bgH, 0, 0, canvas.width, canvas.height);
            
            ctx.filter = 'none'; // Reset filter

            // 2. Draw Contain Image
            // Calculate dimensions to fit inside canvas
            let targetW, targetH, targetX, targetY;
            
            if (iw / ih > containerRatio) {
                // Image is wider than canvas ratio -> fit by width
                targetW = canvas.width;
                targetH = targetW * (ih / iw);
                targetX = 0;
                targetY = (canvas.height - targetH) / 2;
            } else {
                // Image is taller or same -> fit by height
                targetH = canvas.height;
                targetW = targetH * (iw / ih);
                targetY = 0;
                targetX = (canvas.width - targetW) / 2;
            }
            
            // Draw contain image
            ctx.drawImage(bitmap, 0, 0, iw, ih, targetX, targetY, targetW, targetH);
            
        } else {
            // ==================
            // CROP / COVER MODE
            // ==================
            const style = window.getComputedStyle(imgElement);
            const objectPosition = style.objectPosition.split(' ');
            const posXPercent = parseFloat(objectPosition[0]) || 50;
            const posYPercent = parseFloat(objectPosition[1]) || 50;
    
            const { width: iw, height: ih } = bitmap;
            
            let cropW, cropH, cropX, cropY;
    
            if (iw / ih > containerRatio) {
                // Landscape crop
                cropH = ih;
                cropW = ih * containerRatio;
                cropX = (posXPercent / 100) * (iw - cropW);
                cropY = 0;
            } else {
                // Portrait crop
                cropW = iw;
                cropH = iw / containerRatio;
                cropY = (posYPercent / 100) * (ih - cropH);
                cropX = 0;
            }
    
            ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
        }

        // Output logic is same
        canvas.toBlob((blob) => {
            if (!blob) return;
            
            const newUrl = URL.createObjectURL(blob);
            
            const oldUrl = window.uploadedPhotos[0].url;
            window.uploadedPhotos[0].url = newUrl;
            window.uploadedPhotos[0].file = blob;
            
            // Update thumbnails
            // WARNING: renderPhotoPreview usually calls updatePreviewImage logic which might recurse or reset stuff.
            // But renderPhotoPreview just rebuilds thumbnails array DOM.
            if (window.renderPhotoPreview) {
                 window.renderPhotoPreview();
            }
            
            // Update preview image src
            imgElement.src = newUrl;
            
            // If in fit mode, we generated a full image with background, so we just show it regular (cover or contain doesn't matter much as it matches ratio, but cover is safe)
            // Actually since we burned the blur into the image, it is now 4:3 ratio. 
            // So object-fit: cover is fine. 
            // AND we should reset object-position to center because the crop is baked in.
            
            imgElement.style.objectPosition = 'center center';
            
            if (isFitMode) {
                 // Update blur bg too to match (although we baked it in, the UI toggle uses the src)
                 blurBg.style.backgroundImage = `url(${newUrl})`;
            }
            
        }, 'image/jpeg', 0.9);
    }
});

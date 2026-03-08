/**
 * Görsel Yükleme Optimizasyonu
 * Boyut/tip kontrol, sıkıştırma, progress gösterisi
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Görsel dosyayı doğrula
 * @param {File} file
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateImageFile(file) {
    if (!file) return { ok: false, error: 'Dosya seçilmedi' };
    
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { ok: false, error: 'Sadece JPEG, PNG, WebP formatları kabul edilir' };
    }
    
    if (file.size > MAX_FILE_SIZE) {
        return { ok: false, error: `Dosya çok büyük (max 5MB, seçili: ${(file.size/1024/1024).toFixed(1)}MB)` };
    }
    
    return { ok: true, valid: true };
}

/**
 * Tarayıcı tarafı görsel sıkıştırması
 * @param {File} file
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @param {number} quality (0.1 - 1.0)
 * @returns {Promise<Blob>}
 */
export async function compressImage(file, maxWidth = 1200, maxHeight = 900, quality = 0.85, targetSizeBytes = 300 * 1024) {
    // Returns a Blob compressed and optionally converted to WebP when supported.
    // targetSizeBytes: try to get below this size by lowering quality/scale.
    const readImage = () => new Promise((resolve, reject) => {
        // Prefer createImageBitmap when available (faster, no DOM Image)
        if (self.createImageBitmap) {
            const blobForBitmap = file instanceof Blob ? file : new Blob([file], { type: file.type });
            createImageBitmap(blobForBitmap).then(resolve).catch(() => {
                // fallback to Image
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('Görsel yüklenemedi'));
                    img.src = e.target.result;
                };
                reader.onerror = () => reject(new Error('Dosya okunamadı'));
                reader.readAsDataURL(file);
            });
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Görsel yüklenemedi'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Dosya okunamadı'));
            reader.readAsDataURL(file);
        }
    });

    const supportsType = (type) => {
        try {
            const c = document.createElement('canvas');
            return c.toDataURL(type).indexOf(`data:${type}`) === 0;
        } catch (e) {
            return false;
        }
    };

    const preferredType = supportsType('image/webp') ? 'image/webp' : (file.type || 'image/jpeg');

    const image = await readImage();

    // determine initial dimensions preserving aspect ratio
    let width = image.width || image.width || image.naturalWidth || image.width;
    let height = image.height || image.height || image.naturalHeight || image.height;

    if (!width || !height) {
        // fallback: try to read from file via Image
        width = maxWidth;
        height = maxHeight;
    }

    // scale to max dimensions
    const calcDimensions = (w, h, maxW, maxH) => {
        let nw = w;
        let nh = h;
        if (nw > maxW) {
            nh = Math.round((nh * maxW) / nw);
            nw = maxW;
        }
        if (nh > maxH) {
            nw = Math.round((nw * maxH) / nh);
            nh = maxH;
        }
        return [nw, nh];
    };

    let [targetW, targetH] = calcDimensions(width, height, maxWidth, maxHeight);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Draw and attempt compression iteratively
    let currentQuality = quality;
    let currentW = targetW;
    let currentH = targetH;
    let blob = null;

    const drawImageToCanvas = () => {
        canvas.width = currentW;
        canvas.height = currentH;
        // high quality draw when createImageBitmap used
        try { ctx.imageSmoothingQuality = 'high'; } catch (e) {}
        ctx.clearRect(0, 0, currentW, currentH);
        // image could be an HTMLImageElement or ImageBitmap
        ctx.drawImage(image, 0, 0, currentW, currentH);
    };

    const toBlobAsync = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

    // Try several iterations: reduce quality, then reduce dimensions
    for (let pass = 0; pass < 6; pass++) {
        drawImageToCanvas();
        blob = await toBlobAsync(preferredType, currentQuality);
        if (!blob) throw new Error('Sıkıştırma başarısız (blob null)');

        if (blob.size <= targetSizeBytes || (preferredType === file.type && blob.size <= file.size)) {
            break; // good enough
        }

        // decrease quality first
        if (currentQuality > 0.45) {
            currentQuality = Math.max(0.35, currentQuality - 0.15);
            continue;
        }

        // if quality is low, reduce dimensions
        currentW = Math.round(currentW * 0.85);
        currentH = Math.round(currentH * 0.85);
        if (currentW < 200 || currentH < 200) break; // don't go too small
    }

    return blob;
}

/**
 * Dosyayı Base64 string'e dönüştür
 * @param {Blob|File} blob
 * @returns {Promise<string>}
 */
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // base64 part only
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Thumbnail oluştur (listeleme için)
 * @param {File} file
 * @returns {Promise<string>} Base64 URL
 */
export async function createThumbnail(file) {
    const compressed = await compressImage(file, 400, 300, 0.75);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result); // data URL
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
    });
}

/**
 * Görsel yükleme progress'i göster
 * @param {HTMLElement} container
 * @param {number} current
 * @param {number} total
 */
export function updateUploadProgress(container, current, total) {
    if (!container) return;
    const percent = Math.round((current / total) * 100);
    
    let bar = container.querySelector('.upload-progress-bar');
    if (!bar) {
        const wrapper = document.createElement('div');
        wrapper.className = 'upload-progress-wrapper';
        wrapper.innerHTML = `
            <div class="upload-progress-bar"></div>
            <span class="upload-progress-text">0%</span>
        `;
        container.appendChild(wrapper);
        bar = wrapper.querySelector('.upload-progress-bar');
    }
    
    bar.parentElement.querySelector('.upload-progress-bar').style.width = `${percent}%`;
    bar.parentElement.querySelector('.upload-progress-text').textContent = `${percent}%`;
}

/**
 * Görsel yükleme işlemin başında progress göster
 * @param {HTMLElement} container
 */
export function showUploadInProgress(container) {
    if (!container) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'upload-progress-wrapper';
    wrapper.innerHTML = `
        <div class="upload-progress-bar" style="width: 20%; animation: pulse 1s infinite;"></div>
        <span class="upload-progress-text">Yükleniyor...</span>
    `;
    container.appendChild(wrapper);
}

/**
 * Progress gösterisini temizle
 * @param {HTMLElement} container
 */
export function clearUploadProgress(container) {
    if (!container) return;
    const wrapper = container.querySelector('.upload-progress-wrapper');
    if (wrapper) wrapper.remove();
}

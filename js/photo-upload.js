// Fotoğraf yükleme sistemi
import { showToast } from './toast.js';
import { validateImageFile, compressImage, createThumbnail, showUploadInProgress, updateUploadProgress, clearUploadProgress } from './image-optimizer.js';

window.uploadedPhotos = []; // Global değişken yapıyoruz
window.mainPreviewIndex = null; // Büyük önizleme için seçili index

// Bildirim gösterme fonksiyonu
function showNotification(message, type = 'info') {
    // Yeni ortak toast sistemi ile göster
    showToast(message, type, 3000);
}

// setMainPreview artık sadece global state'i güncelliyor ve UI'ı tetikliyor
function setMainPreview(photo, index = null) {
    const uploadArea = document.getElementById('photoUploadArea');
    const previewContainer = document.getElementById('uploadPreviewContainer');
    const input = document.getElementById('photoInput');

    if (photo) {
        window.mainPreviewIndex = index;
        if (uploadArea) uploadArea.classList.add('has-preview');
        if (previewContainer) previewContainer.style.display = 'block';
        // Inputu gizle ki preview karttaki drag çalışsın (z-index ile çözdük ama bu da garanti olsun)
        // Ancak file drop çalışmalı...
        // CSS'de z-index: 10 var container'da, input 5. Card click -> card. Outside -> input.
        
        // window.updatePreviewImage zaten çağrılıyor (renderPhotoPreview'da veya burada)
        // Biz burada çağırmayalım, renderPhotoPreview halletsin.
        // Ama ilk yüklemede renderPhotoPreview updatePreviewImage'i çağırıyor.
    } else {
        window.mainPreviewIndex = null;
        if (uploadArea) uploadArea.classList.remove('has-preview');
        if (previewContainer) previewContainer.style.display = 'none';
        if (input) input.style.display = 'block'; // Ensure input is clickable when empty
    }
}

function handlePhotoUpload(filesInput) {
    console.log('🎯 handlePhotoUpload çağrıldı, gelen parametre:', filesInput);
    
    // filesInput bir FileList olabilir, array'e çevir
    const files = Array.from(filesInput);
    const maxPhotos = 10;
    
    console.log('📸 İşlenecek dosya sayısı:', files.length, 'adet');
    
    if (files.length === 0) {
        console.log('⚠️ Hiç dosya seçilmedi');
        showNotification('Lütfen en az bir fotoğraf seçin', 'error');
        return;
    }
    
    if (window.uploadedPhotos.length + files.length > maxPhotos) {
        const message = `En fazla ${maxPhotos} fotoğraf yükleyebilirsiniz.`;
        showNotification(message, 'error');
        console.log('⚠️', message);
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Yükleme ilerleme UI'ını göster
    const progressContainer = document.querySelector('.photo-upload-area') || document.body;
    showUploadInProgress(progressContainer);
    
    // Tüm dosyaları işle (serial - sırayla)
    files.forEach(async (file, idx) => {
        try {
            // Resim dosyasını valide et
            const validation = validateImageFile(file);
            const isValid = validation?.ok ?? validation?.valid; // backward compatibility
            if (!isValid) {
                console.log('⚠️ Dosya doğrulaması başarısız:', validation?.error, file.name);
                showNotification(`${file.name}: ${validation?.error || 'Geçersiz dosya'}`, 'error');
                errorCount++;
                return;
            }
            
            console.log(`🖼️ Dosya ${idx + 1} sıkıştırılıyor:`, file.name);
            
            // Resimi sıkıştır
            const compressedBlob = await compressImage(file);
            
            // Küçük resim (thumbnail) oluştur (data URL dönüyor)
            const thumbnailBlob = await createThumbnail(file);
            
            // İlerleme güncelle
            updateUploadProgress(progressContainer, idx + 1, files.length);
            
            // URL.createObjectURL kullanarak hızlı önizleme
            const previewBlob = compressedBlob instanceof Blob ? compressedBlob : file;
            const url = URL.createObjectURL(previewBlob);
            const thumbnailUrl = typeof thumbnailBlob === 'string'
                ? thumbnailBlob
                : URL.createObjectURL(thumbnailBlob);
            
            window.uploadedPhotos.push({
                file: compressedBlob instanceof Blob ? compressedBlob : file, // Sıkıştırılmış blob
                url: url,
                thumbnailUrl: thumbnailUrl,
                name: file.name,
                originalSize: file.size,
                compressedSize: compressedBlob?.size ?? 0,
                type: compressedBlob?.type || file.type,
                lastModified: file.lastModified,
                originalFile: file // Orijinal dosyayı sakla (kırpma işlemleri için)
            });
            
            console.log(`✅ Dosya sıkıştırıldı: ${file.name} (${(file.size / 1024).toFixed(2)}KB → ${(compressedBlob.size / 1024).toFixed(2)}KB)`);
            
            // İlk fotoğrafta büyük önizlemeyi ayarla
            if (window.mainPreviewIndex === null) {
                setMainPreview(window.uploadedPhotos[window.uploadedPhotos.length - 1], window.uploadedPhotos.length - 1);
            }

            successCount++;
            
            // Her dosya eklendiğinde önizlemeyi güncelle
            renderPhotoPreview();
        } catch (error) {
            console.error('❌ Dosya yüklenirken hata:', error);
            const message = error?.message || 'Bilinmeyen hata';
            showNotification(`${file.name} yüklenemedi: ${message}`, 'error');
            errorCount++;
        }
    });
    
    // Yükleme ilerleme UI'ını temizle
    setTimeout(() => {
        clearUploadProgress(progressContainer);
    }, 500);
    
    // Sonuç bildirimi
    if (successCount > 0 && errorCount === 0) {
        showNotification(`${successCount} fotoğraf başarıyla yüklendi! ✓`, 'success');
    } else if (successCount > 0 && errorCount > 0) {
        showNotification(`${successCount} fotoğraf yüklendi, ${errorCount} dosya yüklenemedi`, 'error');
    } else if (errorCount > 0) {
        showNotification('Fotoğraflar yüklenemedi. Lütfen geçerli resim dosyaları seçin (JPG, PNG)', 'error');
    }
}

// Drag & Drop State
let draggedItemIndex = null;

function handleDragStart(e) {
    draggedItemIndex = Number(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires setting data
    e.dataTransfer.setData('text/plain', draggedItemIndex);
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary for allowing drop
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.preview-box').forEach(box => {
        box.classList.remove('drag-over');
    });
}

function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    
    this.classList.remove('drag-over');
    
    const targetIndex = Number(this.dataset.index);
    const sourceIndex = draggedItemIndex;

    if (sourceIndex !== null && sourceIndex !== targetIndex && window.uploadedPhotos[sourceIndex]) {
        console.log(`🔄 Fotoğraf sıralaması değişiyor: ${sourceIndex} -> ${targetIndex}`);
        
        // Array'i yeniden sırala
        const item = window.uploadedPhotos[sourceIndex];
        window.uploadedPhotos.splice(sourceIndex, 1);
        window.uploadedPhotos.splice(targetIndex, 0, item);
        
        // Ana önizlemeyi güncelle (ilk fotoğraf her zaman kapak fotoğrafıdır)
        setMainPreview(window.uploadedPhotos[0], 0);

        // UI'ı yenile
        renderPhotoPreview();
    }
    
    return false;
}

function renderPhotoPreview() {
    // Önizleme grid'ini al
    const previewGrid = document.querySelector('.photo-preview-grid');
    
    if (!previewGrid) {
        console.error('❌ .photo-preview-grid bulunamadı!');
        return;
    }
    
    // Tüm kutulari al
    const boxes = previewGrid.querySelectorAll('.preview-box');
    
    if (boxes.length === 0) {
        console.error('❌ .preview-box kutuları bulunamadı!');
        return;
    }
    
    // Her kutuyu güncelle
    boxes.forEach((box, index) => {
        // Event listener'ları temizle (cloneNode ile)
        const newBox = box.cloneNode(true);
        box.parentNode.replaceChild(newBox, box);
        box = newBox;

        if (index < window.uploadedPhotos.length) {
            // Fotoğraf varsa göster
            const photo = window.uploadedPhotos[index];
            box.classList.remove('empty');
            box.setAttribute('draggable', 'true');
            box.dataset.index = index;
            
            box.innerHTML = `
                <img src="${photo.url}" alt="${photo.name || 'Fotoğraf ' + (index + 1)}">
                <button type="button" class="remove-photo" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
                <div class="drag-handle-overlay" title="Sıralamak için sürükleyin"></div>
            `;
            
            // Drag & Drop Event Listeners
            box.addEventListener('dragstart', handleDragStart);
            box.addEventListener('dragover', handleDragOver);
            box.addEventListener('dragleave', handleDragLeave);
            box.addEventListener('drop', handleDrop);
            box.addEventListener('dragend', handleDragEnd);

            // Kutuyu tıklayınca büyük önizleme göster
            box.onclick = (e) => {
                // Silme butonuna tıklandıysa önizleme yapma
                if (e.target.closest('.remove-photo')) return;
                setMainPreview(photo, index);
            };

            // Silme butonu event listener'ı
            const removeBtn = box.querySelector('.remove-photo');
            if (removeBtn) {
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    removePhoto(index);
                };
            }

        } else {
            // Fotoğraf yoksa boş göster
            box.className = 'preview-box empty'; // Reset classes
            box.removeAttribute('draggable');
            delete box.dataset.index;
            
            box.innerHTML = '<i class="fas fa-plus"></i>';
            box.onclick = () => {
                const input = document.getElementById('photoInput');
                if (input) input.click();
            };
        }
    });

    // Canlı önizlemeyi güncelle (Kapak fotoğrafı ve sayı)
    if (window.updatePreviewImage) {
        if (window.uploadedPhotos.length > 0) {
            window.updatePreviewImage(window.uploadedPhotos[0].url, window.uploadedPhotos.length);
        } else {
            window.updatePreviewImage(null, 0);
        }
    }
}

function removePhoto(index) {
    console.log('🗑️ Fotoğraf siliniyor:', index);
    
    // URL'yi temizle (memory leak önleme)
    if (window.uploadedPhotos[index] && window.uploadedPhotos[index].url) {
        URL.revokeObjectURL(window.uploadedPhotos[index].url);
    }
    
    window.uploadedPhotos.splice(index, 1);
    
    // Eğer liste tamamen boşaldıysa
    if (window.uploadedPhotos.length === 0) {
        setMainPreview(null);
    } else {
        // Her zaman ilk fotoğrafı kapak fotoğrafı yap veya mevcut seçimi koru
        // Kullanıcı deneyimi açısından, bir fotoğraf silindiğinde en baştakini göstermek mantıklı
        setMainPreview(window.uploadedPhotos[0], 0);
    }

    renderPhotoPreview();
}

// Global fonksiyon yap
window.handlePhotoUpload = handlePhotoUpload;
window.removePhoto = removePhoto;

// Başlatma fonksiyonu
function initializePhotoUpload() {
    console.log('🚀 Fotoğraf yükleme sistemi başlatılıyor...');
    
    const uploadArea = document.querySelector('.photo-upload-area');
    const photoInput = document.getElementById('photoInput');
    const previewGrid = document.querySelector('.photo-preview-grid');
    
    // Debug: Elementleri kontrol et
    console.log('🔍 Element kontrolü:');
    console.log('  - uploadArea:', uploadArea ? '✅' : '❌');
    console.log('  - photoInput:', photoInput ? '✅' : '❌');
    console.log('  - previewGrid:', previewGrid ? '✅' : '❌');
    
    if (!photoInput) {
        console.error('❌ #photoInput bulunamadı! HTML\'de id="photoInput" olan input var mı?');
        return;
    }
    
    if (!previewGrid) {
        console.error('❌ .photo-preview-grid bulunamadı! HTML yapısını kontrol edin.');
        return;
    }
    
    // Input change eventi - EN ÖNEMLİ KISIM
    photoInput.addEventListener('change', function(e) {
        console.log('📂 Input change eventi tetiklendi');
        console.log('📁 Seçilen dosya sayısı:', e.target.files.length);
        handlePhotoUpload(e.target.files);
    });
    
    console.log('✅ Change event listener eklendi');
    
    if (!uploadArea) {
        console.warn('⚠️ .photo-upload-area bulunamadı, drag&drop çalışmayacak');
        return;
    }
    
    // Drag & Drop desteği
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragging');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragging');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragging');
        
        console.log('📥 Dosyalar sürüklendi');
        
        const files = Array.from(e.dataTransfer.files);
        
        if (files.length === 0) {
            console.log('⚠️ Hiç dosya sürüklenmedi');
            return;
        }
        
        // FileList oluştur
        const dataTransfer = new DataTransfer();
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                dataTransfer.items.add(file);
            }
        });
        
        photoInput.files = dataTransfer.files;
        
        // handlePhotoUpload fonksiyonunu doğru şekilde çağır
        console.log('🚀 handlePhotoUpload çağrılıyor...');
        handlePhotoUpload(photoInput.files);
    });
    
    console.log('✅ Drag & Drop desteği eklendi');
    console.log('📸 Fotoğraf yükleme sistemi hazır!');

    // Başlangıçta boş kutuların tıklama aksiyonlarını kur
    renderPhotoPreview();
}

// Sayfa yüklendiğinde başlat
console.log('🔍 photo-upload.js yüklendi, document.readyState:', document.readyState);

if (document.readyState === 'loading') {
    console.log('⏳ DOM yükleniyor, DOMContentLoaded bekleniyor...');
    document.addEventListener('DOMContentLoaded', function() {
        console.log('✅ DOMContentLoaded tetiklendi');
        initializePhotoUpload();
    });
} else {
    console.log('✅ DOM zaten hazır, hemen başlatılıyor');
    initializePhotoUpload();
}


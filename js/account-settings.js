// Account Settings - User Data Loader
import { supabase } from './supabase.js';
import { 
    getSessions, 
    revokeSession, 
    revokeAllOtherSessions,
    getClientIp,
    exportUserData,
    deleteAccountPermanently
} from './api.js';
import { detectDeviceInfo, getLocationInfo } from './device-detection.js';

// PDF kütüphanesi yükle
const loadHtml2Pdf = async () => {
    if (window.html2pdf) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('PDF kütüphanesi yüklenemedi'));
        document.head.appendChild(script);
    });
};

// PDF içeriği oluştur
const createPdfContent = (userData) => {
    const { user, profile, listings } = userData;
    const now = new Date().toLocaleDateString('tr-TR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; background: white; }
                .header { border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { margin: 0 0 5px 0; color: #10b981; font-size: 28px; }
                .header p { margin: 5px 0; color: #666; font-size: 12px; }
                .section { margin-bottom: 30px; page-break-inside: avoid; }
                .section h2 { color: #10b981; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin: 0 0 15px 0; }
                .info-block { background: #f9fafb; padding: 12px 15px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #10b981; }
                .info-row { display: flex; margin-bottom: 10px; }
                .info-label { font-weight: bold; color: #10b981; width: 150px; min-width: 150px; }
                .info-value { color: #333; word-break: break-word; flex: 1; }
                .listings-grid { display: grid; grid-template-columns: 1fr; gap: 15px; }
                .listing-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #fafafa; page-break-inside: avoid; }
                .listing-card h3 { margin: 0 0 10px 0; color: #10b981; font-size: 16px; }
                .listing-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
                .listing-row { font-size: 12px; color: #666; }
                .listing-description { font-size: 12px; color: #555; margin-top: 10px; line-height: 1.4; }
                .footer { border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
                .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
                .badge.active { background: #d1fae5; color: #065f46; }
                .badge.inactive { background: #fee2e2; color: #991b1b; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📋 Veri Arşivi - VERDE</h1>
                <p>Oluşturulma Tarihi: ${now}</p>
                <p>Kullanıcı: ${user?.email || 'Bilinmiyor'}</p>
            </div>

            <div class="section">
                <h2>👤 Kullanıcı Bilgileri</h2>
                <div class="info-block">
                    <div class="info-row">
                        <div class="info-label">E-posta:</div>
                        <div class="info-value">${user?.email || '-'}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">İsim:</div>
                        <div class="info-value">${profile?.full_name || '-'}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Telefon:</div>
                        <div class="info-value">${user?.phone || '-'}</div>
                    </div>
                    ${user?.metadata?.city ? `
                    <div class="info-row">
                        <div class="info-label">Şehir:</div>
                        <div class="info-value">${user.metadata.city}</div>
                    </div>
                    ` : ''}
                    ${user?.metadata?.birth_date ? `
                    <div class="info-row">
                        <div class="info-label">Doğum Tarihi:</div>
                        <div class="info-value">${user.metadata.birth_date}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
    `;

    // İlanlar bölümü
    if (listings && listings.length > 0) {
        html += `
            <div class="section">
                <h2>📢 İlanlarım (${listings.length})</h2>
                <div class="listings-grid">
        `;

        listings.forEach((listing, idx) => {
            html += `
                <div class="listing-card">
                    <h3>${idx + 1}. ${listing.title || 'İlan'}</h3>
                    <div class="listing-meta">
                        <div class="listing-row"><strong>Fiyat:</strong> ${listing.price || '-'} ${listing.currency || 'TL'}</div>
                        <div class="listing-row"><strong>Kategori:</strong> ${listing.category_id || '-'}</div>
                        <div class="listing-row"><strong>Konum:</strong> ${listing.location_city || '-'}</div>
                        <div class="listing-row"><strong>Durum:</strong> <span class="badge ${listing.status === 'active' ? 'active' : 'inactive'}">${listing.status === 'active' ? 'Aktif' : 'İnaktif'}</span></div>
                    </div>
                    ${listing.description ? `<div class="listing-description"><strong>Açıklama:</strong> ${listing.description}</div>` : ''}
                    <div class="listing-row" style="margin-top: 10px; font-size: 11px; color: #999;">
                        Oluşturulma: ${new Date(listing.created_at).toLocaleDateString('tr-TR')}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="section">
                <h2>📢 İlanlarım</h2>
                <div class="info-block">Henüz ilan yayınlamamışsınız.</div>
            </div>
        `;
    }

    html += `
            <div class="footer">
                <p>Bu belge, VERDE platformu tarafından oluşturulmuştur. İçeriği gizli tutunuz.</p>
                <p>© 2026 VERDE - Tüm Hakları Saklıdır</p>
            </div>
        </body>
        </html>
    `;

    return html;
};

// Basit inline toast (uygulama içi bildirim)
const showInlineToast = (msg, type = 'info') => {
    const el = document.createElement('div');
    el.className = `inline-toast ${type}`;
    el.textContent = msg;
    Object.assign(el.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#111827',
        color: 'white',
        padding: '0.9rem 1.25rem',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        zIndex: 9999,
        fontWeight: 600,
        letterSpacing: '0.01em'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
};

// Özel onay modalı (browser confirm yerine)
const ensureConfirmStyles = () => {
    if (document.getElementById('inline-confirm-styles')) return;
    const style = document.createElement('style');
    style.id = 'inline-confirm-styles';
    style.textContent = `
    .inline-confirm-overlay {position:fixed;inset:0;background:rgba(17,24,39,0.55);display:flex;align-items:center;justify-content:center;z-index:9998;backdrop-filter:blur(2px);} 
    .inline-confirm {background:#0b1628;color:#e5e7eb;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:22px 24px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.35);animation:popIn 180ms ease-out;} 
    .inline-confirm h4 {margin:0 0 8px 0;font-size:1.05rem;color:#f9fafb;font-weight:700;} 
    .inline-confirm p {margin:0 0 16px 0;line-height:1.5;color:#cbd5e1;font-size:0.95rem;} 
    .inline-confirm-actions {display:flex;gap:10px;justify-content:flex-end;} 
    .inline-btn {border:none;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;transition:transform 0.12s ease, box-shadow 0.12s ease;} 
    .inline-btn:active {transform:translateY(1px);} 
    .inline-btn.cancel {background:#1f2937;color:#e5e7eb;} 
    .inline-btn.danger {background:#ef4444;color:white;box-shadow:0 8px 25px rgba(239,68,68,0.35);} 
    @keyframes popIn {from{transform:translateY(10px) scale(0.98);opacity:0;} to{transform:translateY(0) scale(1);opacity:1;}}
    `;
    document.head.appendChild(style);
};

const showConfirmModal = (title, message) => {
    ensureConfirmStyles();
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'inline-confirm-overlay';
        const modal = document.createElement('div');
        modal.className = 'inline-confirm';
        modal.innerHTML = `
            <h4>${title}</h4>
            <p>${message}</p>
            <div class="inline-confirm-actions">
                <button class="inline-btn cancel" type="button">Vazgeç</button>
                <button class="inline-btn danger" type="button">Onayla</button>
            </div>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const cleanup = (value) => {
            overlay.remove();
            resolve(value);
        };

        modal.querySelector('.cancel').addEventListener('click', () => cleanup(false));
        modal.querySelector('.danger').addEventListener('click', () => cleanup(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) cleanup(false);
        });
    });
};

// Kullanıcı verilerini yükle ve formu doldur
export async function loadUserData() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            console.log('Kullanıcı girişi bulunamadı, login sayfasına yönlendiriliyor...');
            window.location.href = 'login.html';
            return;
        }

        // E-posta (auth'tan)
        const emailInput = document.getElementById('email');
        if (emailInput) emailInput.value = user.email || '';

        // Metadata'dan bilgileri çek
        const metadata = user.user_metadata || {};
        
        // Ad ve Soyad
        const firstNameInput = document.getElementById('firstName');
        const lastNameInput = document.getElementById('lastName');
        
        if (metadata.full_name) {
            const nameParts = metadata.full_name.split(' ');
            if (firstNameInput) firstNameInput.value = nameParts[0] || '';
            if (lastNameInput) lastNameInput.value = nameParts.slice(1).join(' ') || '';
        } else if (metadata.first_name || metadata.last_name) {
            if (firstNameInput) firstNameInput.value = metadata.first_name || '';
            if (lastNameInput) lastNameInput.value = metadata.last_name || '';
        }

        // Telefon
        const phoneInput = document.getElementById('phone');
        if (phoneInput && (metadata.phone || user.phone)) {
            phoneInput.value = metadata.phone || user.phone || '';
        }

        // Doğum tarihi
        const birthDateInput = document.getElementById('birthDate');
        if (birthDateInput && metadata.birth_date) {
            birthDateInput.value = metadata.birth_date;
        }

        // Cinsiyet
        const genderSelect = document.getElementById('gender');
        if (genderSelect && metadata.gender) {
            genderSelect.value = metadata.gender;
        }

        // Şehir ve İlçe
        const citySelect = document.getElementById('city');
        const districtSelect = document.getElementById('district');
        
        if (citySelect && metadata.city) {
            citySelect.value = metadata.city;
            // Şehir seçimi tetikle (ilçeler yüklensin)
            citySelect.dispatchEvent(new Event('change'));
            
            // İlçe bilgisi varsa seç
            if (districtSelect && metadata.district) {
                setTimeout(() => {
                    districtSelect.value = metadata.district;
                }, 100);
            }
        }

        // Adres
        const addressInput = document.getElementById('address');
        if (addressInput && metadata.address) {
            addressInput.value = metadata.address;
        }

        // Profil fotoğrafı
        const profileImage = document.getElementById('profileImage');
        if (profileImage && metadata.avatar_url) {
            profileImage.src = metadata.avatar_url;
        }

        // Bildirim tercihleri
        const preferences = metadata.preferences || {};
        const notifyMessages = document.getElementById('notifyMessages');
        const notifyPriceChanges = document.getElementById('notifyPriceChanges');
        const notifyListingsUpdates = document.getElementById('notifyListingsUpdates');
        const notifyMarketing = document.getElementById('notifyMarketing');

        if (notifyMessages) notifyMessages.checked = preferences.messages !== false;
        if (notifyPriceChanges) notifyPriceChanges.checked = preferences.priceChanges !== false;
        if (notifyListingsUpdates) notifyListingsUpdates.checked = preferences.listingsUpdates !== false;
        if (notifyMarketing) notifyMarketing.checked = preferences.marketing !== false;

    } catch (error) {
        console.error('Kullanıcı verileri yüklenirken hata:', error);
    }
}

// Form güncelleme - Kişisel Bilgiler
export async function updatePersonalInfo(formData) {
    try {
        const firstName = formData.get('firstName');
        const lastName = formData.get('lastName');
        const fullName = `${firstName} ${lastName}`.trim();
        
        const updateData = {
            data: {
                full_name: fullName,
                first_name: firstName,
                last_name: lastName,
                phone: formData.get('phone'),
                birth_date: formData.get('birthDate'),
                gender: formData.get('gender')
            }
        };

        const { error } = await supabase.auth.updateUser(updateData);
        if (error) throw error;
        
        return { success: true };
    } catch (error) {
        console.error('Güncelleme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Form güncelleme - Adres Bilgileri
export async function updateAddressInfo(formData) {
    try {
        const updateData = {
            data: {
                city: formData.get('city'),
                district: formData.get('district'),
                address: formData.get('address')
            }
        };

        const { error } = await supabase.auth.updateUser(updateData);
        if (error) throw error;
        
        return { success: true };
    } catch (error) {
        console.error('Güncelleme hatası:', error);
        return { success: false, error: error.message };
    }
}

// Tercihleri güncelle - Bildirimler
export async function updateNotificationPreferences(preferences) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Kullanıcı bulunamadı');

        const currentMetadata = user.user_metadata || {};
        const currentPreferences = currentMetadata.preferences || {};
        
        const updateData = {
            data: {
                ...currentMetadata,
                preferences: {
                    ...currentPreferences,
                    ...preferences
                }
            }
        };

        const { error } = await supabase.auth.updateUser(updateData);
        if (error) throw error;
        
        return { success: true };
    } catch (error) {
        console.error('Bildirim tercihleri güncellenemedi:', error);
        return { success: false, error: error.message };
    }
}

// Form dinleyicilerini başlat
export function initAccountSettings() {
    console.log('✅ initAccountSettings başlatıldı');
    
    // Kişisel bilgiler formu
    const personalInfoForm = document.getElementById('personalInfoForm');
    if (personalInfoForm) {
        personalInfoForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitBtn = this.querySelector('.btn-primary');
            const originalText = submitBtn.innerHTML;
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kaydediliyor...';
            submitBtn.disabled = true;

            const formData = new FormData(this);
            const result = await updatePersonalInfo(formData);

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if (result.success) {
                if (typeof showNotification === 'function') {
                    showNotification('Kişisel bilgileriniz başarıyla güncellendi!', 'success');
                } else {
                    showInlineToast('Kişisel bilgileriniz başarıyla güncellendi!', 'success');
                }
            } else {
                if (typeof showNotification === 'function') {
                    showNotification('Güncelleme sırasında bir hata oluştu: ' + result.error, 'error');
                } else {
                    showInlineToast('Güncelleme sırasında bir hata oluştu: ' + result.error, 'error');
                }
            }
        });
    }

    // Adres formu
    const addressForm = document.getElementById('addressForm');
    if (addressForm) {
        addressForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitBtn = this.querySelector('.btn-primary');
            const originalText = submitBtn.innerHTML;
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kaydediliyor...';
            submitBtn.disabled = true;

            const formData = new FormData(this);
            const result = await updateAddressInfo(formData);

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

            if (result.success) {
                if (typeof showNotification === 'function') {
                    showNotification('Adres bilgileriniz başarıyla kaydedildi!', 'success');
                } else {
                    showInlineToast('Adres bilgileriniz başarıyla kaydedildi!', 'success');
                }
            } else {
                if (typeof showNotification === 'function') {
                    showNotification('Güncelleme sırasında bir hata oluştu: ' + result.error, 'error');
                } else {
                    showInlineToast('Güncelleme sırasında bir hata oluştu: ' + result.error, 'error');
                }
            }
        });
    }
    
    // Sessions yönetimini başlat
    loadAndDisplaySessions();
    setupSessionEventListeners();

    // Bildirim tercihleri - Event listener'lar
    const notificationToggles = [
        { id: 'notifyMessages', key: 'messages' },
        { id: 'notifyPriceChanges', key: 'priceChanges' },
        { id: 'notifyListingsUpdates', key: 'listingsUpdates' },
        { id: 'notifyMarketing', key: 'marketing' }
    ];

    notificationToggles.forEach(toggle => {
        const el = document.getElementById(toggle.id);
        if (el) {
            el.addEventListener('change', async function() {
                const result = await updateNotificationPreferences({ [toggle.key]: this.checked });
                if (result.success) {
                    if (typeof showNotification === 'function') {
                        showNotification('Bildirim tercihleriniz güncellendi', 'success');
                    } else if (typeof showInlineToast === 'function') {
                        showInlineToast('Bildirim tercihleriniz güncellendi', 'success');
                    }
                } else {
                    // Hata durumunda eski haline getir
                    this.checked = !this.checked;
                    if (typeof showNotification === 'function') {
                        showNotification('Hata: ' + result.error, 'error');
                    }
                }
            });
        }
    });

    // Hesap silme
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    console.log('🔍 deleteAccountBtn bulundu mu?', !!deleteAccountBtn);
    if (deleteAccountBtn) {
        console.log('✅ deleteAccountBtn event listener ekleniyor');
        deleteAccountBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmModal('Hesabı kalıcı olarak sil', 'Hesabınız ve verileriniz kalıcı olarak silinecek. Onaylıyor musunuz?');
            if (!confirmed) return;

            const originalHTML = deleteAccountBtn.innerHTML;
            deleteAccountBtn.disabled = true;
            deleteAccountBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Siliniyor...';

            try {
                await deleteAccountPermanently();

                if (typeof showNotification === 'function') {
                    showNotification('Hesabınız silindi. Güle güle!', 'success');
                } else {
                    showInlineToast('Hesabınız silindi. Güle güle!', 'success');
                }

                window.location.href = 'login.html';
            } catch (error) {
                console.error('Hesap silme hatası:', error);
                if (typeof showNotification === 'function') {
                    showNotification('Hesap silinemedi: ' + error.message, 'error');
                } else {
                    showInlineToast('Hesap silinemedi: ' + error.message, 'error');
                }
            } finally {
                deleteAccountBtn.disabled = false;
                deleteAccountBtn.innerHTML = originalHTML;
            }
        });
    }
}

// ============================================================
// OTURUM YÖNETİMİ FONKSİYONLARI
// ============================================================

/**
 * Konum bilgisini parse et (getLocationInfo kullan)
 * @returns {Promise<String>} Konum gösterimi
 */
async function getLocationDisplay() {
    const locationInfo = await getLocationInfo();
    return `${locationInfo.city}, ${locationInfo.country}`;
}

/**
 * İnsana okunur son aktivite zamanını döndür
 * @param {String} lastActivityTime - ISO format zaman
 * @returns {String} İnsana okunur format
 */
function formatLastActivity(lastActivityTime) {
    const now = new Date();
    const lastActivity = new Date(lastActivityTime);
    const diffMs = now - lastActivity;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
        return 'Şimdi';
    } else if (diffMins < 60) {
        return `${diffMins} dakika önce`;
    } else if (diffHours < 24) {
        return `${diffHours} saat önce`;
    } else if (diffDays < 7) {
        return `${diffDays} gün önce`;
    } else {
        return lastActivity.toLocaleDateString('tr-TR');
    }
}

/**
 * Oturum kartı HTML'i oluştur
 * @param {Object} session - Oturum verisi
 * @param {Boolean} isCurrent - Geçerli oturum mu?
 * @returns {String} HTML
 */
function createSessionHTML(session, isCurrent) {
    const deviceInfo = session.device_info || {};
    const icon = deviceInfo.deviceIcon || deviceInfo.osIcon || 'fa-desktop';
    
    // Cihaz adını daha iyi şekilde formatla
    // Format: "Cihaz Markası Model - Tarayıcı" (örn: "Apple MacBook - Chrome")
    let displayDeviceName = '';
    if (deviceInfo.deviceBrand && deviceInfo.deviceModel) {
        displayDeviceName = `${deviceInfo.deviceBrand} ${deviceInfo.deviceModel} - ${deviceInfo.browserName || 'Browser'}`;
    } else if (deviceInfo.deviceBrand) {
        displayDeviceName = `${deviceInfo.deviceBrand} - ${deviceInfo.browserName || 'Browser'}`;
    } else {
        displayDeviceName = deviceInfo.deviceName || `${deviceInfo.osName || 'OS'} - ${deviceInfo.browserName || 'Browser'}`;
    }
    
    const city = deviceInfo.city || 'Unknown';
    const country = deviceInfo.country || 'Unknown';
    const location = `${city}, ${country}`;
    const lastActivity = formatLastActivity(session.last_activity);
    const createdDate = new Date(session.created_at).toLocaleDateString('tr-TR', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let html = `
        <div class="session-item ${isCurrent ? 'current' : ''}" data-session-id="${session.id}">
            <div class="session-info">
                <div class="session-device">
                    <i class="fas ${icon}"></i>
                    <span>${displayDeviceName}</span>
                    ${isCurrent ? '<span class="current-badge">Mevcut</span>' : ''}
                </div>
                <div class="session-details">
                    <span><i class="fas fa-map-marker-alt"></i> ${location}</span>
                    <span><i class="fas fa-clock"></i> Son etkinlik: ${lastActivity}</span>
                    <span style="font-size: 0.8rem; color: #9ca3af;"><i class="fas fa-plus"></i> Giriş: ${createdDate}</span>
                </div>
            </div>
            <div class="session-actions">
                <button class="btn-danger-outline revoke-session-btn" data-session-id="${session.id}" title="Bu oturumu sonlandır">
                    <i class="fas fa-times-circle"></i>
                    <span>Sonlandır</span>
                </button>
                ${isCurrent ? `
                    <span class="session-warning-badge" title="Bu cihazdan çıkış yapacaksınız">
                        <i class="fas fa-exclamation-triangle"></i> Dikkat
                    </span>
                ` : ''}
            </div>
        </div>
    `;

    return html;
}

/**
 * Oturum listesini yükle ve göster
 */
async function loadAndDisplaySessions() {
    const loadingContainer = document.getElementById('sessionsLoadingContainer');
    const sessionsList = document.getElementById('sessionsList');
    const errorContainer = document.getElementById('sessionsErrorContainer');

    try {
        // Loading durumunu göster
        if (loadingContainer) loadingContainer.style.display = 'flex';
        if (sessionsList) sessionsList.innerHTML = '';
        if (errorContainer) errorContainer.style.display = 'none';

        // Oturumları yükle
        const sessions = await getSessions();
        
        // Geçerli session'ı belirle
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const currentSessionToken = currentSession?.access_token.substring(0, 50);

        if (sessions.length === 0) {
            if (sessionsList) {
                sessionsList.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: #6b7280;">
                        <i class="fas fa-info-circle" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                        <p>Henüz kayıtlı oturum yok</p>
                    </div>
                `;
            }
        } else {
            // Oturumları döndür - geçerli oturum önce
            let html = '';
            
            // Geçerli oturum
            const currentSessions = sessions.filter(s => s.session_token === currentSessionToken);
            const otherSessions = sessions.filter(s => s.session_token !== currentSessionToken);
            
            currentSessions.forEach(session => {
                html += createSessionHTML(session, true);
            });
            
            // Diğer oturumlar
            otherSessions.forEach(session => {
                html += createSessionHTML(session, false);
            });

            if (sessionsList) sessionsList.innerHTML = html;
        }

        // Loading durumunu gizle
        if (loadingContainer) loadingContainer.style.display = 'none';

    } catch (error) {
        console.error('Oturumlar yüklenirken hata:', error);
        
        if (errorContainer) {
            errorContainer.style.display = 'block';
            const errorMsg = document.getElementById('sessionsErrorMessage');
            if (errorMsg) {
                errorMsg.textContent = error.message || 'Oturumlar yüklenirken bir hata oluştu';
            }
        }
        
        if (loadingContainer) loadingContainer.style.display = 'none';
    }
}

/**
 * Oturum event listener'larını kur
 */
function setupSessionEventListeners() {
    const sessionsList = document.getElementById('sessionsList');
    const revokeAllBtn = document.getElementById('revokeAllSessionsBtn');

    // Tek oturumu sonlandır
    if (sessionsList) {
        sessionsList.addEventListener('click', async function(e) {
            const revokeBtn = e.target.closest('.revoke-session-btn');
            if (revokeBtn) {
                const sessionId = revokeBtn.getAttribute('data-session-id');
                const sessionItem = revokeBtn.closest('.session-item');
                const isCurrent = sessionItem?.classList.contains('current');
                
                // Uyarı mesajı
                let confirmMessage = 'Bu oturumu sonlandırmak istediğinizden emin misiniz?';
                if (isCurrent) {
                    confirmMessage = '⚠️ BU OTURUM ŞU ANKİ OTURUMUNUZDUR!\n\nSonlandırırsanız, şu anda kullanmakta olduğunuz cihazdan çıkış yapacaksınız.\n\nDevam etmek istediğinizden emin misiniz?';
                }
                
                const _ok = await showConfirmModal('Oturumu sonlandır', confirmMessage);
                if (!_ok) return;

                try {
                    revokeBtn.disabled = true;
                    const originalHTML = revokeBtn.innerHTML;
                    revokeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Sonlandırılıyor...</span>';

                    // Mevcut oturum mu değil mi bilgisini gönder
                    await revokeSession(sessionId, isCurrent);

                    // Eğer mevcut oturum değilse listeyi yenile
                    if (!isCurrent) {
                        await loadAndDisplaySessions();
                        setupSessionEventListeners(); // Event listener'ları yeniden kur

                        if (typeof showNotification === 'function') {
                            showNotification('Oturum başarıyla sonlandırıldı', 'success');
                        } else {
                            showInlineToast('Oturum başarıyla sonlandırıldı', 'success');
                        }
                    } else {
                        // Mevcut oturumsa, signOut otomatik çalıştı, login'e yönlendir
                        if (typeof showNotification === 'function') {
                            showNotification('Çıkış yapılıyor...', 'success');
                        }
                        setTimeout(() => {
                            window.location.href = 'login.html';
                        }, 500);
                    }
                } catch (error) {
                    console.error('Oturum sonlandırma hatası:', error);
                    revokeBtn.disabled = false;
                    revokeBtn.innerHTML = originalHTML;
                    
                    if (typeof showNotification === 'function') {
                        showNotification('Oturum sonlandırılamadı: ' + error.message, 'error');
                    } else {
                        showInlineToast('❌ Oturum sonlandırılamadı: ' + error.message, 'error');
                    }
                }
            }
        });
    }

    // Tüm diğer oturumları sonlandır
    if (revokeAllBtn) {
        revokeAllBtn.addEventListener('click', async function() {
            const confirmMessage = '⚠️ DİĞER TÜM OTURUMLARI SONLANDIR\n\n' +
                '• Mevcut cihazınız (şu an kullandığınız) oturumda kalmaya devam edecek\n' +
                '• Diğer tüm cihazlardan otomatik çıkış yapılacak\n' +
                '• Bu işlem geri alınamaz\n\n' +
                'Devam etmek istediğinizden emin misiniz?';
            
            const _okAll = await showConfirmModal('Diğer Oturumları Sonlandır', confirmMessage);
            if (!_okAll) return;

            try {
                this.disabled = true;
                const originalHTML = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sonlandırılıyor...';

                await revokeAllOtherSessions();

                // Listeyi yenile - sadece mevcut oturum kalmalı
                await loadAndDisplaySessions();
                setupSessionEventListeners();

                if (typeof showNotification === 'function') {
                    showNotification('✅ Diğer tüm oturumlar başarıyla sonlandırıldı. Sadece bu cihaz aktif.', 'success');
                } else {
                    showInlineToast('✅ Diğer tüm oturumlar başarıyla sonlandırıldı', 'success');
                }

                this.disabled = false;
                this.innerHTML = originalHTML;
            } catch (error) {
                console.error('Tüm oturumları sonlandırma hatası:', error);
                this.disabled = false;
                this.innerHTML = originalHTML;
                
                if (typeof showNotification === 'function') {
                    showNotification('❌ Oturumlar sonlandırılamadı: ' + error.message, 'error');
                } else {
                    showInlineToast('❌ Oturumlar sonlandırılamadı: ' + error.message, 'error');
                }
            }
        });
    }
}

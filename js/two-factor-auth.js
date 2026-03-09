// js/two-factor-auth.js - İki Faktörlü Doğrulama (2FA) Sistemi
// Supabase built-in MFA entegrasyonu
import { supabase } from './supabase.js';

// ===== 2FA YÖNETİMİ =====

/**
 * TOTP (Time-based One-Time Password) ile 2FA enrollment başlat
 * Google Authenticator, Microsoft Authenticator, Authy gibi uygulamalar çalışır
 */
export async function enrollTOTP() {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
    });

    if (error) throw error;

    console.log('✅ TOTP enrollment successful');
    return {
      qrCode: data?.totp?.qr_code,
      secret: data?.totp?.secret,
      factorId: data?.id,
    };
  } catch (error) {
    console.error('❌ TOTP enrollment error:', error);
    throw error;
  }
}

/**
 * TOTP kodunu doğrula ve 2FA'yı etkinleştir
 */
export async function verifyTOTP(factorId, code) {
  try {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factorId,
      code: code,
    });

    if (error) throw error;

    console.log('✅ TOTP verified, 2FA enabled');
    logSecurityEvent('2fa_enabled', { method: 'totp' });
    return data;
  } catch (error) {
    console.error('❌ TOTP verification error:', error);
    throw error;
  }
}

/**
 * SMS ile 2FA enrollment başlat
 */
export async function enrollSMS(phoneNumber) {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'phone',
      phone: phoneNumber,
    });

    if (error) throw error;

    console.log('✅ SMS enrollment successful');
    return {
      factorId: data?.id,
      message: 'SMS code sent',
    };
  } catch (error) {
    console.error('❌ SMS enrollment error:', error);
    throw error;
  }
}

/**
 * SMS kodunu doğrula ve 2FA'yı etkinleştir
 */
export async function verifySMS(factorId, code) {
  try {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factorId,
      code: code,
    });

    if (error) throw error;

    console.log('✅ SMS verified, 2FA enabled');
    logSecurityEvent('2fa_enabled', { method: 'sms' });
    return data;
  } catch (error) {
    console.error('❌ SMS verification error:', error);
    throw error;
  }
}

/**
 * Kullanıcının 2FA faktörlerini listele
 */
export async function list2FAFactors() {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) throw error;

    return data?.factors || [];
  } catch (error) {
    console.error('❌ Error fetching 2FA factors:', error);
    return [];
  }
}

/**
 * 2FA faktörünü sil
 */
export async function unenrollMFAFactor(factorId) {
  try {
    const { error } = await supabase.auth.mfa.unenroll({
      factorId: factorId,
    });

    if (error) throw error;

    console.log('✅ 2FA factor deleted');
    logSecurityEvent('2fa_disabled', { factorId });
    return true;
  } catch (error) {
    console.error('❌ Error deleting 2FA factor:', error);
    throw error;
  }
}

/**
 * MFA challenge başlat (login sırasında)
 * 2FA etkinleştirilmiş kullanıcılar için doğrulama kodu gerekli
 */
export async function createMFAChallenge(factorId) {
  try {
    const { data, error } = await supabase.auth.mfa.challenge({
      factorId: factorId,
    });

    if (error) throw error;

    console.log('✅ MFA challenge created');
    return data?.id; // Challenge ID
  } catch (error) {
    console.error('❌ Error creating MFA challenge:', error);
    throw error;
  }
}

/**
 * MFA challenge'ı doğrula (login sırasında)
 */
export async function verifyMFAChallenge(factorId, challengeId, code) {
  try {
    const { data, error } = await supabase.auth.mfa.verifyChallenge({
      factorId: factorId,
      challengeId: challengeId,
      code: code,
    });

    if (error) throw error;

    console.log('✅ MFA challenge verified, logged in');
    logSecurityEvent('login_2fa_verified', { factorId });
    return data;
  } catch (error) {
    console.error('❌ Error verifying MFA challenge:', error);
    throw error;
  }
}

// ===== UI HELPER FONKSİYONLARI =====

/**
 * 2FA kurulum sihirbazını başlat
 */
window.setupTwoFactor = async function () {
  const selectedMethod = document.querySelector('input[name="twoFactorMethod"]:checked');
  
  if (!selectedMethod) {
    showNotification('Please select a verification method.', 'warning');
    return;
  }

  const method = selectedMethod.value;
  
  try {
    if (method === 'totp') {
      await setupTOTPUI();
    } else if (method === 'sms') {
      await setupSMSUI();
    } else if (method === 'email') {
      showNotification('Email 2FA will be added soon', 'info');
    }
  } catch (error) {
    showNotification('2FA setup failed: ' + error.message, 'error');
  }
};

/**
 * TOTP UI kurulumu
 */
async function setupTOTPUI() {
  try {
    const result = await enrollTOTP();
    
    // QR kod göster
    const modal = document.createElement('div');
    modal.className = 'modal-2fa';
    modal.innerHTML = `
      <div class="modal-content-2fa">
        <h3>Google Authenticator Kurulumu</h3>
        <p>Aşağıdaki QR kodu Google Authenticator, Microsoft Authenticator veya Authy uygulamasıyla tarayın:</p>
        
        <div class="qr-code-container">
          <img src="${result.qrCode}" alt="2FA QR Code" class="qr-code">
        </div>
        
        <p>Ya da manuel olarak bu kodu girin:</p>
        <code class="secret-code">${result.secret}</code>
        
        <div class="verification-code">
          <label>Uygulamadaki 6 haneli kodu girin:</label>
          <input type="text" id="twoFactorCode" maxlength="6" placeholder="000000" pattern="\\d{6}">
          <button onclick="confirmTOTPSetup('${result.factorId}')" class="btn-primary">
            Doğrula ve Etkinleştir
          </button>
        </div>
        
        <button onclick="closeTOFAModal()" class="btn-secondary">İptal</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    showNotification('Open the authenticator app for 2FA setup', 'info');
  } catch (error) {
    throw error;
  }
}

/**
 * TOTP kurulumunu onaylama
 */
window.confirmTOTPSetup = async function (factorId) {
  const code = document.getElementById('twoFactorCode').value;
  
  if (!code || code.length !== 6) {
    showNotification('6 haneli kodu girin', 'warning');
    return;
  }
  
  try {
    await verifyTOTP(factorId, code);
    showNotification('✅ Two-factor authentication enabled!', 'success');
    closeTOFAModal();
    updateTwoFactorUI();
  } catch (error) {
    showNotification('Incorrect code: ' + error.message, 'error');
  }
};

/**
 * SMS UI kurulumu
 */
async function setupSMSUI() {
  const phoneNumber = prompt('Please enter your phone number (e.g., +905551234567):');
  
  if (!phoneNumber) return;
  
  try {
    const result = await enrollSMS(phoneNumber);
    
    const code = prompt('SMS\'e gelen 6 haneli kodu girin:');
    if (!code) return;
    
    await verifySMS(result.factorId, code);
    showNotification('✅ 2FA via SMS enabled!', 'success');
    updateTwoFactorUI();
  } catch (error) {
    showNotification('SMS setup failed: ' + error.message, 'error');
  }
}

/**
 * 2FA faktörleri UI'de güncelle
 */
async function updateTwoFactorUI() {
  try {
    const factors = await list2FAFactors();
    const container = document.getElementById('activeTwoFactors');
    
    if (!container) return;
    
    if (factors.length === 0) {
      container.innerHTML = '<p>2FA not enabled yet</p>';
      return;
    }
    
    container.innerHTML = factors.map(factor => `
      <div class="factor-item">
        <div class="factor-info">
          <h4>${factor.factor_type === 'totp' ? '📱 Authenticator' : '📞 SMS'}</h4>
          <p>Etkinleştirildi: ${new Date(factor.created_at).toLocaleDateString('tr-TR')}</p>
        </div>
        <button onclick="removeTwoFactor('${factor.id}')" class="btn-danger-sm">
          Kaldır
        </button>
      </div>
    `).join('');
  } catch (error) {
    console.error('UI update error:', error);
  }
}

/**
 * 2FA faktörünü kaldır
 */
window.removeTwoFactor = async function (factorId) {
  if (!confirm('Are you sure you want to remove this 2FA factor?')) return;
  
  try {
    await unenrollMFAFactor(factorId);
    showNotification('✅ 2FA factor removed', 'success');
    updateTwoFactorUI();
  } catch (error) {
    showNotification('Removal failed: ' + error.message, 'error');
  }
};

/**
 * Modal'ı kapat
 */
window.closeTOFAModal = function () {
  const modal = document.querySelector('.modal-2fa');
  if (modal) modal.remove();
};

// ===== YARDIMCI FONKSİYONLAR =====

/**
 * Bildirim göster
 */
function showNotification(message, type = 'info') {
  // Toast mensaj göster (mevcut toast.js'i kullan)
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Güvenlik olayını kaydet
 */
function logSecurityEvent(eventType, details = {}) {
  // Security logging sistemi (security-logging.js'den çağırılacak)
  if (window.logSecurityEvent) {
    window.logSecurityEvent(eventType, details);
  }
}

// ===== INITIALIZATION =====

// Sayfa yüklendiğinde 2FA faktörlerini göster
document.addEventListener('DOMContentLoaded', async () => {
  const twoFactorToggle = document.getElementById('twoFactorToggle');
  
  if (twoFactorToggle) {
    // Mevcut faktörleri kontrol et
    const factors = await list2FAFactors();
    const hasFactors = factors.length > 0;
    
    twoFactorToggle.checked = hasFactors;
    
    // Event listener ekle
    twoFactorToggle.addEventListener('change', function () {
      const methods = document.getElementById('twoFactorMethods');
      if (methods) {
        methods.style.display = this.checked ? 'block' : 'none';
      }
    });
    
    // Başlangıçta mevcut faktörleri göster
    if (hasFactors) {
      updateTwoFactorUI();
    }
  }
});

export default {
  enrollTOTP,
  verifyTOTP,
  enrollSMS,
  verifySMS,
  list2FAFactors,
  unenrollMFAFactor,
  createMFAChallenge,
  verifyMFAChallenge,
  updateTwoFactorUI,
};

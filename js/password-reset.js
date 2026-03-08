// js/password-reset.js - Password Reset System
// "Forgot Password" feature

import { supabase } from './supabase.js';
import { logSecurityEvent } from './security-logging.js';
import { 
  checkPasswordResetRateLimit, 
  recordPasswordResetAttempt 
} from './rate-limiter.js';

// ===== ŞİFRE SIFIRLAMA İSTEĞİ =====

/**
 * Şifre sıfırlama emaili gönder
 */
export async function requestPasswordReset(email) {
  try {
    // Rate limiting kontrolü (3 deneme/gün)
    const rateLimitCheck = checkPasswordResetRateLimit(email);
    if (rateLimitCheck.limited) {
      throw new Error(rateLimitCheck.message);
    }

    // Supabase'den reset email gönder
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`,
    });

    if (error) throw error;

    // Rate limiting attempt kaydet
    recordPasswordResetAttempt(email);

    // Log security event
    await logSecurityEvent('password_reset_requested', { email }, 'info');

    return {
      success: true,
      message: 'A password reset link has been sent to your email address.',
    };
  } catch (error) {
    console.error('Password reset request error:', error);
    throw error;
  }
}

/**
 * Yeni şifre belirle (reset token ile)
 */
export async function updatePassword(newPassword) {
  try {
    // Şifre validasyonu
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    // Log security event
    await logSecurityEvent('password_changed', 
      { method: 'reset_link' }, 
      'critical'
    );

    return {
      success: true,
      message: 'Your password has been successfully changed.',
    };
  } catch (error) {
    console.error('Password update error:', error);
    throw error;
  }
}

// ===== ŞİFRE DEĞİŞTİRME (GÜVENLİK AYARLARINDA) =====

/**
 * Mevcut şifreyi doğrula ve yeni şifre belirle
 */
export async function changePassword(currentPassword, newPassword) {
  try {
    // Validasyon
    if (!currentPassword || !newPassword) {
      throw new Error('Please fill in all fields');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    // Önce mevcut kullanıcıyı al
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.email) {
      throw new Error('User session not found');
    }

    // Mevcut şifreyi doğrulamak için yeniden giriş yap
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      throw new Error('Current password is incorrect');
    }

    // Yeni şifreyi kaydet
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) throw updateError;

    // Log security event
    await logSecurityEvent('password_changed', 
      { method: 'settings_page' }, 
      'critical'
    );

    return {
      success: true,
      message: 'Your password has been successfully changed.',
    };
  } catch (error) {
    console.error('Change password error:', error);
    throw error;
  }
}

// ===== ŞİFRE GÜCÜ HESAPLAMA =====

/**
 * Şifre gücünü hesapla (0-5)
 */
export function calculatePasswordStrength(password) {
  let score = 0;
  
  if (!password) return 0;
  
  // Uzunluk kontrolü
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  
  // Karakter çeşitliliği
  if (/[a-z]/.test(password)) score++; // Küçük harf
  if (/[A-Z]/.test(password)) score++; // Büyük harf
  if (/\d/.test(password)) score++; // Sayı
  if (/[^a-zA-Z\d]/.test(password)) score++; // Özel karakter
  
  return Math.min(score, 5);
}

/**
 * Şifre güvenlik gereksinimleri kontrolü
 */
export function validatePasswordRequirements(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^a-zA-Z\d]/.test(password),
  };
}

// ===== UI HELPER FONKSİYONLARI =====

/**
 * Şifre sıfırlama modal'ını göster
 */
export function showPasswordResetModal() {
  const modal = document.createElement('div');
  modal.className = 'password-reset-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <button class="modal-close" onclick="closePasswordResetModal()">
        <i class="fas fa-times"></i>
      </button>
      
      <h2><i class="fas fa-key"></i> Forgot Password</h2>
      <p>Enter your email address and we'll send you a link to reset your password.</p>
      
      <form id="passwordResetForm">
        <div class="form-group">
          <label for="resetEmail">Email Address</label>
          <input 
            type="email" 
            id="resetEmail" 
            placeholder="example@email.com"
            required
          >
        </div>
        
        <button type="submit" class="btn-primary">
          <i class="fas fa-paper-plane"></i>
          Send Reset Link
        </button>
      </form>
      
      <div class="reset-info">
        <i class="fas fa-info-circle"></i>
        Link is valid for 1 hour
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Form submit handler
  document.getElementById('passwordResetForm').addEventListener('submit', handlePasswordResetSubmit);
}

/**
 * Şifre sıfırlama form submit handler
 */
async function handlePasswordResetSubmit(event) {
  event.preventDefault();
  
  const email = document.getElementById('resetEmail').value;
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  
  try {
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;
    
    const result = await requestPasswordReset(email);
    
    showNotification(result.message, 'success');
    closePasswordResetModal();
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

/**
 * Modal'ı kapat
 */
window.closePasswordResetModal = function() {
  const modal = document.querySelector('.password-reset-modal');
  if (modal) modal.remove();
};

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    // Fallback to console if everything fails, but avoid alert
    console.log(`[Notification] ${type}: ${message}`);
  }
}

// ===== LOGIN PAGE: "FORGOT PASSWORD" LINK =====

document.addEventListener('DOMContentLoaded', () => {
  // Find "Forgot Password" link and add event listener
  const forgotPasswordLinks = document.querySelectorAll('[data-action="forgot-password"], .forgot-password-link');
  
  forgotPasswordLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showPasswordResetModal();
    });
  });
});

// ===== GLOBAL EXPORT =====

window.requestPasswordReset = requestPasswordReset;
window.updatePassword = updatePassword;
window.changePassword = changePassword;
window.showPasswordResetModal = showPasswordResetModal;

export default {
  requestPasswordReset,
  updatePassword,
  changePassword,
  calculatePasswordStrength,
  validatePasswordRequirements,
  showPasswordResetModal,
};

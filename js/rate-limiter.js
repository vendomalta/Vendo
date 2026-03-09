// js/rate-limiter.js - Rate Limiting Sistemi
// Brute force saldırılarından koruma

export class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 60 * 60 * 1000) {
    this.maxAttempts = maxAttempts; // Max attempts
    this.windowMs = windowMs; // Time window (default 1 hour)
    this.attempts = {}; // { 'key': [{ timestamp, count }] }
  }

  /**
   * Belirli bir key için rate limit'i kontrol et
   */
  isLimited(key) {
    const now = Date.now();
    const userAttempts = this.attempts[key] || [];
    
    // Time window'ı geçmiş attempts'i filtrele
    const recentAttempts = userAttempts.filter(
      attempt => now - attempt.timestamp < this.windowMs
    );
    
    // Güncel attempts'i kaydet
    this.attempts[key] = recentAttempts;
    
    // Limit aşıldı mı?
    return recentAttempts.length >= this.maxAttempts;
  }

  /**
   * Yeni attempt'i kaydet
   */
  recordAttempt(key) {
    if (!this.attempts[key]) {
      this.attempts[key] = [];
    }
    
    this.attempts[key].push({
      timestamp: Date.now(),
    });
  }

  /**
   * Kalan deneme sayısını getir
   */
  getRemainingAttempts(key) {
    const now = Date.now();
    const userAttempts = this.attempts[key] || [];
    
    const recentAttempts = userAttempts.filter(
      attempt => now - attempt.timestamp < this.windowMs
    );
    
    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }

  /**
   * Lock süresini getir (kaç dakika daha?)
   */
  getLockTimeRemaining(key) {
    if (!this.isLimited(key)) return 0;
    
    const now = Date.now();
    const userAttempts = this.attempts[key] || [];
    
    if (userAttempts.length === 0) return 0;
    
    const oldestAttempt = userAttempts[0].timestamp;
    const timeRemaining = this.windowMs - (now - oldestAttempt);
    
    return Math.ceil(timeRemaining / 1000 / 60); // minutes
  }

  /**
   * Belirli bir key'i reset et
   */
  reset(key) {
    delete this.attempts[key];
  }

  /**
   * Tüm attempts'i temizle
   */
  resetAll() {
    this.attempts = {};
  }
}

// ===== Global Rate Limiters =====

/**
 * Login attempts limiter - Progressive lockout
 * 3 deneme → 3 dakika kilit
 * 5 deneme → 30 dakika kilit
 */
export const loginLimiter = {
  attempts: {}, // { 'key': [{ timestamp, count }] }
  
  isLimited(email) {
    const key = `login_${email}`;
    const now = Date.now();
    const userAttempts = this.attempts[key] || [];
    
    // Son 30 dakikada yapılan denemeleri filtrele
    const recentAttempts = userAttempts.filter(
      attempt => now - attempt.timestamp < 30 * 60 * 1000
    );
    
    this.attempts[key] = recentAttempts;
    
    // Deneme sayısına göre kontrol
    if (recentAttempts.length >= 5) {
      return { limited: true, minutes: 30 };
    } else if (recentAttempts.length >= 3) {
      return { limited: true, minutes: 3 };
    }
    
    return { limited: false };
  },
  
  recordAttempt(email) {
    const key = `login_${email}`;
    if (!this.attempts[key]) this.attempts[key] = [];
    
    this.attempts[key].push({ timestamp: Date.now() });
  },
  
  getRemainingAttempts(email) {
    const key = `login_${email}`;
    const now = Date.now();
    const userAttempts = this.attempts[key] || [];
    
    const recentAttempts = userAttempts.filter(
      attempt => now - attempt.timestamp < 30 * 60 * 1000
    );
    
    return Math.max(0, 5 - recentAttempts.length);
  },
  
  reset(email) {
    const key = `login_${email}`;
    delete this.attempts[key];
  }
};

/**
 * Password reset limiter (3 attempts per day)
 */
export const passwordResetLimiter = new RateLimiter(
  3, // 3 attempts
  24 * 60 * 60 * 1000 // 24 hours
);

/**
 * API call limiter (100 requests per minute)
 */
export const apiLimiter = new RateLimiter(
  100, // 100 requests
  60 * 1000 // 1 minute
);

/**
 * Form submission limiter (10 per minute)
 */
export const formLimiter = new RateLimiter(
  10, // 10 submissions
  60 * 1000 // 1 minute
);

/**
 * Message sending limiter (5 per minute)
 */
export const messageLimiter = new RateLimiter(
  5, 
  60 * 1000
);

/**
 * Listing creation limiter (3 per 10 minutes)
 */
export const listingLimiter = new RateLimiter(
  3,
  10 * 60 * 1000
);

/**
 * Profile update limiter (2 per minute)
 */
export const profileUpdateLimiter = new RateLimiter(
  2,
  60 * 1000
);

// ===== LOGIN SPECIFIC FUNCTIONS =====

/**
 * Login için rate limit kontrolü yap
 * 3 deneme → 3 dakika
 * 5 deneme → 30 dakika
 */
export function checkLoginRateLimit(email) {
  const result = loginLimiter.isLimited(email);
  
  if (result.limited) {
    return {
      limited: true,
      message: `Çok fazla başarısız deneme. ${result.minutes} dakika sonra tekrar deneyin.`,
      minutesRemaining: result.minutes,
    };
  }
  
  const remaining = loginLimiter.getRemainingAttempts(email);
  return {
    limited: false,
    remaining,
    message: `Kalan deneme: ${remaining}/5`,
  };
}

/**
 * Başarısız login attempt'ini kaydet
 */
export function recordFailedLogin(email) {
  loginLimiter.recordAttempt(email);
}

/**
 * Başarılı login'den sonra limiter'i reset et
 */
export function clearLoginRateLimit(email) {
  loginLimiter.reset(email);
}

// ===== PASSWORD RESET SPECIFIC FUNCTIONS =====

/**
 * Password reset için rate limit kontrolü yap
 */
export function checkPasswordResetRateLimit(email) {
  const key = `password_reset_${email}`;
  
  if (passwordResetLimiter.isLimited(key)) {
    const minutesRemaining = passwordResetLimiter.getLockTimeRemaining(key);
    return {
      limited: true,
      message: `Çok fazla sıfırlama denemesi. ${minutesRemaining} dakika sonra tekrar deneyin.`,
      minutesRemaining,
    };
  }
  
  const remaining = passwordResetLimiter.getRemainingAttempts(key);
  return {
    limited: false,
    remaining,
    message: `Kalan deneme: ${remaining}/${passwordResetLimiter.maxAttempts}`,
  };
}

/**
 * Password reset attempt'ini kaydet
 */
export function recordPasswordResetAttempt(email) {
  const key = `password_reset_${email}`;
  passwordResetLimiter.recordAttempt(key);
}

/**
 * Password reset'i reset et
 */
export function clearPasswordResetRateLimit(email) {
  const key = `password_reset_${email}`;
  passwordResetLimiter.reset(key);
}

// ===== STORAGE PERSISTENCE (Optional) =====

/**
 * Rate limiter state'ini localStorage'a kaydet
 * (Browser refresh'ten sonra da koruma devam etsin)
 */
export function persistRateLimitState() {
  try {
    const state = {
      loginAttempts: loginLimiter.attempts,
      passwordResetAttempts: passwordResetLimiter.attempts,
      timestamp: Date.now(),
    };
    localStorage.setItem('rate_limit_state', JSON.stringify(state));
  } catch (error) {
    console.warn('Could not persist rate limit state:', error);
  }
}

/**
 * localStorage'dan rate limiter state'ini restore et
 */
export function restoreRateLimitState() {
  try {
    const stored = localStorage.getItem('rate_limit_state');
    if (!stored) return;
    
    const state = JSON.parse(stored);
    const now = Date.now();
    
    // Eğer 30 dakikadan fazla geçtiyse restore etme (expire olmuş olabilir)
    if (now - state.timestamp > 30 * 60 * 1000) {
      localStorage.removeItem('rate_limit_state');
      return;
    }
    
    loginLimiter.attempts = state.loginAttempts || {};
    passwordResetLimiter.attempts = state.passwordResetAttempts || {};
    
    console.log('✅ Rate limit state restored from localStorage');
  } catch (error) {
    console.warn('Could not restore rate limit state:', error);
  }
}

// ===== AUTO-PERSIST =====

// State'i her 30 saniyede bir kaydet
setInterval(() => {
  persistRateLimitState();
}, 30 * 1000);

// Page unload'da kaydet
window.addEventListener('beforeunload', () => {
  persistRateLimitState();
});

// Page load'da restore et
document.addEventListener('DOMContentLoaded', () => {
  restoreRateLimitState();
});

export default {
  RateLimiter,
  loginLimiter,
  passwordResetLimiter,
  apiLimiter,
  formLimiter,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginRateLimit,
  checkPasswordResetRateLimit,
  recordPasswordResetAttempt,
  clearPasswordResetRateLimit,
  persistRateLimitState,
  restoreRateLimitState,
};

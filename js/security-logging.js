// js/security-logging.js - Güvenlik Olayları Logging Sistemi
// Tüm güvenlik olaylarını database'e kaydet

import { supabase } from './supabase.js';

// ===== LOGGING CONFIGURATION =====

const SECURITY_EVENTS = {
  // Authentication events
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  SIGNUP: 'signup',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_CHANGED: 'password_changed',
  
  // 2FA events
  TWO_FA_ENABLED: '2fa_enabled',
  TWO_FA_DISABLED: '2fa_disabled',
  TWO_FA_VERIFIED: '2fa_verified',
  TWO_FA_FAILED: '2fa_failed',
  
  // Session events
  SESSION_CREATED: 'session_created',
  SESSION_TERMINATED: 'session_terminated',
  SESSION_EXPIRED: 'session_expired',
  
  // Account changes
  ACCOUNT_SETTINGS_CHANGED: 'account_settings_changed',
  EMAIL_CHANGED: 'email_changed',
  PHONE_CHANGED: 'phone_changed',
  
  // Security concerns
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  MULTIPLE_FAILED_LOGINS: 'multiple_failed_logins',
  BRUTE_FORCE_ATTEMPT: 'brute_force_attempt',
  
  // Admin actions
  ADMIN_LOGIN: 'admin_login',
  ADMIN_ACTION: 'admin_action',
  USER_BANNED: 'user_banned',
};

// ===== UTILITY FONKSİYONLARI =====

/**
 * Client IP adresini al (Supabase function aracılığıyla)
 * Note: Frontend'de doğru IP alamayız, backend'den gelmeli
 */
export async function getClientIP() {
  try {
    // Eğer header'da varsa (proxy aracılığıyla)
    const ip = document.querySelector('meta[name="client-ip"]')?.content;
    if (ip) return ip;
    
    // Supabase function çağır
    const { data, error } = await supabase.functions.invoke('get-client-ip');
    return data?.ip || 'Unknown';
  } catch (error) {
    console.warn('Could not get client IP:', error);
    return 'Unknown';
  }
}

/**
 * User agent bilgisini al ve parse et
 */
export function parseUserAgent() {
  const ua = navigator.userAgent;
  
  // Browser
  let browser = 'Unknown';
  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';
  else if (ua.indexOf('Opera') > -1) browser = 'Opera';
  
  // OS
  let os = 'Unknown';
  if (ua.indexOf('Win') > -1) os = 'Windows';
  else if (ua.indexOf('Mac') > -1) os = 'macOS';
  else if (ua.indexOf('Linux') > -1) os = 'Linux';
  else if (ua.indexOf('Android') > -1) os = 'Android';
  else if (ua.indexOf('iPhone') > -1) os = 'iOS';
  
  // Device
  let device = 'Desktop';
  if (ua.indexOf('Mobile') > -1 || ua.indexOf('Android') > -1) device = 'Mobile';
  else if (ua.indexOf('Tablet') > -1 || ua.indexOf('iPad') > -1) device = 'Tablet';
  
  return {
    userAgent: ua,
    browser,
    os,
    device,
  };
}

/**
 * Lokasyon bilgisini al (GeoIP - Supabase edge function gerekli)
 */
export async function getLocationInfo() {
  try {
    const { data, error } = await supabase.functions.invoke('get-geolocation');
    if (data) {
      return {
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
        latitude: data.latitude,
        longitude: data.longitude,
      };
    }
  } catch (error) {
    console.warn('Could not get location:', error);
  }
  return null;
}

// ===== MAIN LOGGING FUNCTION =====

/**
 * Güvenlik olayını database'e kaydet
 */
export async function logSecurityEvent(eventType, details = {}, severity = 'info') {
  try {
    // Şu anki kullanıcıyı al
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    
    if (!userId) {
      console.warn('Cannot log event - user not authenticated');
      return;
    }
    
    // Device bilgilerini al
    const deviceInfo = parseUserAgent();
    const ip = await getClientIP();
    const location = await getLocationInfo();
    
    // Event'i database'e ekle
    const { data, error } = await supabase
      .from('security_logs')
      .insert({
        user_id: userId,
        event_type: eventType,
        severity: severity,
        details: JSON.stringify({
          ...details,
          device: deviceInfo,
          location,
          timestamp: new Date().toISOString(),
        }),
        ip_address: ip,
        user_agent: deviceInfo.userAgent,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        device_type: deviceInfo.device,
        created_at: new Date().toISOString(),
      });
    
    if (error) {
      console.error('❌ Security log error:', error);
      // Offline fallback - localStorage'a kaydet
      saveLogLocally({
        eventType,
        details,
        severity,
        deviceInfo,
        ip,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log('✅ Security event logged:', eventType);
    }
  } catch (error) {
    console.error('❌ Logging failed:', error);
  }
}

/**
 * Offline log'ları localStorage'a kaydet
 */
function saveLogLocally(logData) {
  try {
    const logs = JSON.parse(localStorage.getItem('offline_security_logs') || '[]');
    logs.push(logData);
    
    // Max 100 log tut
    if (logs.length > 100) {
      logs.shift();
    }
    
    localStorage.setItem('offline_security_logs', JSON.stringify(logs));
    console.log('📝 Log saved locally (offline)');
  } catch (error) {
    console.error('Local logging failed:', error);
  }
}

/**
 * Offline log'ları database'e sync et
 */
export async function syncOfflineLogs() {
  try {
    const logs = JSON.parse(localStorage.getItem('offline_security_logs') || '[]');
    
    if (logs.length === 0) return;
    
    const { data, error } = await supabase
      .from('security_logs')
      .insert(logs);
    
    if (error) throw error;
    
    // Başarılıysa localStorage'ı temizle
    localStorage.removeItem('offline_security_logs');
    console.log(`✅ ${logs.length} offline logs synced`);
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// ===== EVENT-SPECIFIC LOGGING =====

/**
 * Başarılı login'i kaydet
 */
export async function logLoginSuccess(email, method = 'email') {
  await logSecurityEvent(
    SECURITY_EVENTS.LOGIN_SUCCESS,
    {
      email,
      method, // 'email', 'google', 'github', etc.
    },
    'info'
  );
}

/**
 * Başarısız login'i kaydet
 */
export async function logLoginFailed(email, reason = 'Invalid credentials') {
  await logSecurityEvent(
    SECURITY_EVENTS.LOGIN_FAILED,
    {
      email,
      reason,
    },
    'warning'
  );
}

/**
 * Logout'u kaydet
 */
export async function logLogout() {
  await logSecurityEvent(
    SECURITY_EVENTS.LOGOUT,
    {
      timestamp: new Date().toISOString(),
    },
    'info'
  );
}

/**
 * Şifre değişimini kaydet
 */
export async function logPasswordChanged() {
  await logSecurityEvent(
    SECURITY_EVENTS.PASSWORD_CHANGED,
    {
      action: 'User changed password',
    },
    'critical'
  );
}

/**
 * 2FA'yı etkinleştir/devre dışı bırak
 */
export async function log2FAToggled(method, enabled) {
  await logSecurityEvent(
    enabled ? SECURITY_EVENTS.TWO_FA_ENABLED : SECURITY_EVENTS.TWO_FA_DISABLED,
    {
      method, // 'totp', 'sms', 'email'
      enabled,
    },
    'critical'
  );
}

/**
 * Şüpheli aktiviteyi kaydet
 */
export async function logSuspiciousActivity(description, details = {}) {
  await logSecurityEvent(
    SECURITY_EVENTS.SUSPICIOUS_ACTIVITY,
    {
      description,
      ...details,
    },
    'critical'
  );
}

/**
 * Çok sayıda başarısız login denemesini kaydet
 */
export async function logMultipleFailedLogins(email, attemptCount) {
  await logSecurityEvent(
    SECURITY_EVENTS.MULTIPLE_FAILED_LOGINS,
    {
      email,
      attempts: attemptCount,
    },
    'critical'
  );
}

/**
 * Admin işlemini kaydet
 */
export async function logAdminAction(action, targetId, details = {}) {
  await logSecurityEvent(
    SECURITY_EVENTS.ADMIN_ACTION,
    {
      action,
      targetId,
      ...details,
    },
    'critical'
  );
}

// ===== MONITORING & ALERTS =====

/**
 * Başarısız login denemelerini izle (Brute force detection)
 */
export function trackFailedLogin(email) {
  const key = `failed_logins_${email}`;
  let attempts = parseInt(localStorage.getItem(key) || '0');
  attempts++;
  
  // 5 dakika içinde 5'ten fazla deneme
  const timestamp = Date.now();
  const lastAttemptTime = parseInt(localStorage.getItem(`${key}_time`) || '0');
  
  if (timestamp - lastAttemptTime > 5 * 60 * 1000) {
    // 5 dakika geçti, sıfırla
    attempts = 1;
  }
  
  localStorage.setItem(key, attempts.toString());
  localStorage.setItem(`${key}_time`, timestamp.toString());
  
  if (attempts > 5) {
    logMultipleFailedLogins(email, attempts);
    return false; // Account lock
  }
  
  return true; // Tekrar deneme yapılabilir
}

/**
 * Başarılı login'den sonra counters'ı sıfırla
 */
export function clearFailedLoginCounter(email) {
  const key = `failed_logins_${email}`;
  localStorage.removeItem(key);
  localStorage.removeItem(`${key}_time`);
}

// ===== SECURITY LOG VIEWER =====

/**
 * Kullanıcının security log'larını getir
 */
export async function getSecurityLogs(limit = 50) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    
    if (!userId) return [];
    
    const { data, error } = await supabase
      .from('security_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Could not fetch security logs:', error);
    return [];
  }
}

/**
 * Security log'ları CSV'ye dönüştür
 */
export function convertLogsToCSV(logs) {
  if (logs.length === 0) return '';
  
  const headers = ['Tarih', 'Event', 'Severity', 'IP', 'Browser', 'OS', 'Device'];
  const rows = logs.map(log => [
    new Date(log.created_at).toLocaleString('tr-TR'),
    log.event_type,
    log.severity,
    log.ip_address,
    log.browser,
    log.os,
    log.device_type,
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  return csv;
}

/**
 * Security log'larını indir
 */
export async function downloadSecurityReport() {
  try {
    const logs = await getSecurityLogs(100);
    const csv = convertLogsToCSV(logs);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `security-report-${new Date().toISOString()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ Security report downloaded');
  } catch (error) {
    console.error('Report download failed:', error);
  }
}

// ===== MAKE GLOBALLY AVAILABLE =====

window.logSecurityEvent = logSecurityEvent;
window.logLoginSuccess = logLoginSuccess;
window.logLoginFailed = logLoginFailed;
window.logLogout = logLogout;
window.downloadSecurityReport = downloadSecurityReport;

export default {
  SECURITY_EVENTS,
  logSecurityEvent,
  logLoginSuccess,
  logLoginFailed,
  logLogout,
  logPasswordChanged,
  log2FAToggled,
  logSuspiciousActivity,
  logMultipleFailedLogins,
  logAdminAction,
  trackFailedLogin,
  clearFailedLoginCounter,
  getSecurityLogs,
  convertLogsToCSV,
  downloadSecurityReport,
  syncOfflineLogs,
};

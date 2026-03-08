// Device Detection Utility - Cihaz bilgisini tespit et
// Basit ve etkili browser/OS/device detection

/**
 * User Agent'dan cihaz bilgisini ayrıştır
 * @returns {Object} Cihaz bilgileri
 */
export function detectDeviceInfo() {
    const ua = navigator.userAgent;
    const uaLower = ua.toLowerCase();

    // OS Tespit
    let osName = 'Unknown OS';
    let osIcon = 'fa-desktop';

    if (uaLower.includes('windows')) {
        osName = 'Windows';
        if (uaLower.includes('windows nt 10.0')) {
            osName = uaLower.includes('nt 10.0; win64') ? 'Windows 11' : 'Windows 10';
        } else if (uaLower.includes('windows nt 6.3')) osName = 'Windows 8.1';
        else if (uaLower.includes('windows nt 6.2')) osName = 'Windows 8';
        osIcon = 'fa-windows';
    } else if (uaLower.includes('mac os x')) {
        osName = 'macOS';
        osIcon = 'fa-apple';
    } else if (uaLower.includes('linux')) {
        osName = 'Linux';
        osIcon = 'fa-linux';
    } else if (uaLower.includes('iphone') || uaLower.includes('ipod')) {
        osName = 'iOS';
        osIcon = 'fa-mobile-alt';
    } else if (uaLower.includes('ipad')) {
        osName = 'iPadOS';
        osIcon = 'fa-tablet-alt';
    } else if (uaLower.includes('android')) {
        osName = 'Android';
        osIcon = 'fa-mobile-alt';
    }

    // Browser Tespit
    let browserName = 'Unknown Browser';
    let browserIcon = 'fa-globe';

    if (uaLower.includes('edg/') || uaLower.includes('edga/')) {
        browserName = 'Microsoft Edge';
        browserIcon = 'fa-edge';
    } else if (uaLower.includes('chrome') && !uaLower.includes('chromium') && !uaLower.includes('edg')) {
        browserName = 'Google Chrome';
        browserIcon = 'fa-chrome';
    } else if (uaLower.includes('firefox')) {
        browserName = 'Mozilla Firefox';
        browserIcon = 'fa-firefox';
    } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
        browserName = 'Apple Safari';
        browserIcon = 'fa-safari';
    } else if (uaLower.includes('opera') || uaLower.includes('opr/')) {
        browserName = 'Opera';
        browserIcon = 'fa-opera';
    } else if (uaLower.includes('trident') || uaLower.includes('msie')) {
        browserName = 'Internet Explorer';
        browserIcon = 'fa-globe';
    }

    // Cihaz Türü Tespit
    let deviceType = 'Desktop';
    let deviceIcon = 'fa-desktop';

    if (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone') || uaLower.includes('ipod')) {
        deviceType = 'Mobile';
        deviceIcon = 'fa-mobile-alt';
    } else if (uaLower.includes('tablet') || uaLower.includes('ipad')) {
        deviceType = 'Tablet';
        deviceIcon = 'fa-tablet-alt';
    }

    // Cihaz Markası Algılama (Device Model)
    let deviceBrand = '';
    let deviceModel = '';
    
    // Apple Devices
    if (uaLower.includes('iphone')) {
        deviceBrand = 'Apple';
        if (uaLower.includes('iphone 15')) deviceModel = 'iPhone 15';
        else if (uaLower.includes('iphone 14')) deviceModel = 'iPhone 14';
        else if (uaLower.includes('iphone 13')) deviceModel = 'iPhone 13';
        else if (uaLower.includes('iphone 12')) deviceModel = 'iPhone 12';
        else deviceModel = 'iPhone';
    } else if (uaLower.includes('ipad')) {
        deviceBrand = 'Apple';
        if (uaLower.includes('ipad pro')) deviceModel = 'iPad Pro';
        else if (uaLower.includes('ipad air')) deviceModel = 'iPad Air';
        else if (uaLower.includes('ipad mini')) deviceModel = 'iPad mini';
        else deviceModel = 'iPad';
    } else if (uaLower.includes('macintosh') || uaLower.includes('mac os x')) {
        deviceBrand = 'Apple';
        if (uaLower.includes('intel')) deviceModel = 'MacBook (Intel)';
        else if (uaLower.includes('arm') || uaLower.includes('m1') || uaLower.includes('m2') || uaLower.includes('m3')) deviceModel = 'MacBook (Apple Silicon)';
        else deviceModel = 'Mac';
    }
    // Android Devices
    else if (uaLower.includes('android')) {
        if (uaLower.includes('samsung')) {
            deviceBrand = 'Samsung';
            deviceModel = 'Samsung Device';
        } else if (uaLower.includes('pixel')) {
            deviceBrand = 'Google';
            deviceModel = 'Pixel';
        } else if (uaLower.includes('oneplus')) {
            deviceBrand = 'OnePlus';
            deviceModel = 'OnePlus Device';
        } else if (uaLower.includes('xiaomi')) {
            deviceBrand = 'Xiaomi';
            deviceModel = 'Xiaomi Device';
        } else if (uaLower.includes('huawei')) {
            deviceBrand = 'Huawei';
            deviceModel = 'Huawei Device';
        } else {
            deviceBrand = 'Android';
            deviceModel = 'Android Device';
        }
    }
    // Windows/Desktop
    else {
        // Cihaz adı genellikle User Agent'da yoktur, ancak OS bilgisini kullanabiliriz
        deviceBrand = osName.split(' ')[0]; // Windows, Linux, vb
        deviceModel = '';
    }

    // Genel cihaz adı oluştur
    let deviceName;
    if (deviceModel && deviceBrand) {
        deviceName = `${deviceBrand} ${deviceModel} - ${browserName}`;
    } else if (deviceBrand) {
        deviceName = `${deviceBrand} - ${browserName}`;
    } else {
        deviceName = `${osName} - ${browserName}`;
    }

    return {
        deviceType,
        osName,
        browserName,
        deviceBrand,
        deviceModel,
        deviceName,
        deviceIcon,
        osIcon,
        browserIcon,
        userAgent: ua.substring(0, 255)
    };
}

/**
 * Coğrafi konum bilgisini al (IP tabanlı)
 * @returns {Promise<Object>} Konum bilgileri
 */
export async function getLocationInfo() {
    try {
        // ipapi.co kullan (5000 free req/month)
        const response = await fetch('https://ipapi.co/json/', {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Location fetch failed');

        const data = await response.json();
        return {
            city: data.city || 'Unknown',
            region: data.region || '',
            country: data.country_name || 'Unknown',
            country_code: data.country_code || '',
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            timezone: data.timezone || '',
            isp: data.org || '',
            ip: data.ip || ''
        };
    } catch (error) {
        console.warn('Konum bilgisi alınamadı:', error);
        return {
            city: 'Unknown',
            region: '',
            country: 'Unknown',
            country_code: '',
            latitude: null,
            longitude: null,
            timezone: '',
            isp: '',
            ip: ''
        };
    }
}

/**
 * Tam cihaz ve konum bilgisini al
 * @returns {Promise<Object>} Tüm cihaz bilgileri
 */
export async function getFullDeviceInfo() {
    const deviceInfo = detectDeviceInfo();
    const locationInfo = await getLocationInfo();

    return {
        ...deviceInfo,
        ...locationInfo
    };
}

/**
 * Tarayıcıdan sözleşiyi al
 * @returns {String} Sözleşi
 */
export function getBrowserFingerprint() {
    const fingerprint = {
        screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown'
    };
    
    return JSON.stringify(fingerprint);
}

// Service Worker - Offline desteği ve cache yönetimi
const CACHE_NAME = 'verde-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/variables.css',
    '/css/reset.css',
    '/css/layout.css',
    '/css/sidebar.css',
    '/css/listings.css',
    '/css/responsive.css',
    '/js/supabase.js',
    '/js/api.js',
    '/js/request-manager.js',
    '/js/url-sync.js',
    '/js/form-validator.js',
    '/js/image-optimizer.js',
    '/js/logger.js',
    '/assets/images/verde-logo.svg'
];

// Install: statik varlıkları cache'le
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn ('Bazı varlıklar cache\'lenemedi:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate: eski cache'leri temizle
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network First (dinamik), Cache Fallback (statik)
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // HTML, JSON, API istekleri: Network First
    if (request.method === 'GET' && 
        (request.mode === 'navigate' || url.pathname.endsWith('.json'))) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Başarılıysa cache'ye kaydet
                    if (response.ok && request.method === 'GET') {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, response.clone());
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Network başarısızsa cache'den al
                    return caches.match(request).then((cachedResponse) => {
                        return cachedResponse || new Response(
                            'Çevrim dışı - sayfa cache\'den gösteriliyor',
                            {status: 503, statusText: 'Service Unavailable' }
                        );
                    });
                })
        );
        return;
    }

    // Diğer GET istekleri: Cache First, fallback Network
    if (request.method === 'GET') {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                return cachedResponse || fetch(request).then((response) => {
                    // Sayfalar dışındaki varlıkları cache'le
                    if (response.ok && !request.url.includes('api')) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, response.clone());
                        });
                    }
                    return response;
                }).catch(() => {
                    // Offline fallback
                    return new Response('Çevrim dışı - varlık yüklenemedi', {
                        status: 503
                    });
                });
            })
        );
        return;
    }

    // POST/PUT/DELETE: Network only
    event.respondWith(fetch(request));
});

// Push notification desteği (isteğe bağlı)
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const title = data.title || 'VERDE Bildirim';
    const options = {
        body: data.body || '',
        icon: '/assets/images/verde-logo-192.png',
        badge: '/assets/images/verde-logo-96.png',
        tag: 'verde-notification',
        requireInteraction: false,
        ...data.options
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Bildirim tıklaması
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

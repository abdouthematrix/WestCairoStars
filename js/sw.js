//==========================Service Worker for Caching==================================//

const CACHE_NAME = 'west-cairo-v1.0.0';
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/js/app.js',
    '/styles.css',
    '/js/modules/auth.js',
    '/js/modules/dashboard.js',
    '/js/modules/leaderboard.js',
    '/js/modules/admin.js',
    '/js/modules/utils.js',
    '/Pages/login.html',
    '/Pages/dashboard.html',
    '/Pages/leaderboard.html',
    '/Pages/admin.html'
];

const DYNAMIC_CACHE_URLS = [
    // Firebase URLs will be cached dynamically
    'https://www.gstatic.com/firebasejs/',
    // API calls will be cached with strategy
];

// Install event - cache static resources
self.addEventListener('install', event => {
    console.log('Service Worker installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static resources...');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                console.log('Static resources cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Failed to cache static resources:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => cacheName !== CACHE_NAME)
                        .map(cacheName => {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('Old caches cleaned up');
                return self.clients.claim();
            })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip Chrome extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // Handle different types of requests with appropriate strategies
    if (isStaticResource(request)) {
        // Cache First strategy for static resources
        event.respondWith(cacheFirst(request));
    } else if (isApiRequest(request)) {
        // Network First strategy for API calls
        event.respondWith(networkFirst(request));
    } else if (isFirebaseRequest(request)) {
        // Stale While Revalidate for Firebase resources
        event.respondWith(staleWhileRevalidate(request));
    } else {
        // Network First with fallback for everything else
        event.respondWith(networkFirst(request));
    }
});

// Cache strategies
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.error('Cache First strategy failed:', error);
        return new Response('Network error', {
            status: 408,
            statusText: 'Network error'
        });
    }
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('Network failed, trying cache...');

        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        return new Response('Content not available offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(error => {
        console.error('Network request failed:', error);
        return cachedResponse;
    });

    return cachedResponse || fetchPromise;
}

// Helper functions to identify request types
function isStaticResource(request) {
    const url = new URL(request.url);
    const staticExtensions = ['.js', '.css', '.html', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
        STATIC_CACHE_URLS.some(staticUrl => url.pathname === staticUrl || url.pathname.endsWith(staticUrl));
}

function isApiRequest(request) {
    const url = new URL(request.url);
    return url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase.googleapis.com');
}

function isFirebaseRequest(request) {
    const url = new URL(request.url);
    return url.hostname.includes('gstatic.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('google');
}

// Handle background sync for offline actions
self.addEventListener('sync', event => {
    console.log('Background sync triggered:', event.tag);

    switch (event.tag) {
        case 'background-sync-scores':
            event.waitUntil(syncPendingScores());
            break;
        case 'background-sync-members':
            event.waitUntil(syncPendingMembers());
            break;
        default:
            console.log('Unknown sync tag:', event.tag);
    }
});

// Background sync functions
async function syncPendingScores() {
    try {
        // Get pending score updates from IndexedDB or localStorage
        const pendingScores = JSON.parse(localStorage.getItem('pendingScoreUpdates') || '[]');

        if (pendingScores.length === 0) {
            return;
        }

        console.log(`Syncing ${pendingScores.length} pending score updates...`);

        // Process each pending update
        for (const update of pendingScores) {
            try {
                // This would need to be implemented with the actual Firebase API
                await syncScoreUpdate(update);
            } catch (error) {
                console.error('Failed to sync score update:', error);
                // Keep failed updates for next sync
                continue;
            }
        }

        // Clear synced updates
        localStorage.removeItem('pendingScoreUpdates');
        console.log('Pending score updates synced successfully');

    } catch (error) {
        console.error('Background sync failed for scores:', error);
    }
}

async function syncPendingMembers() {
    try {
        const pendingMembers = JSON.parse(localStorage.getItem('pendingMemberUpdates') || '[]');

        if (pendingMembers.length === 0) {
            return;
        }

        console.log(`Syncing ${pendingMembers.length} pending member updates...`);

        for (const update of pendingMembers) {
            try {
                await syncMemberUpdate(update);
            } catch (error) {
                console.error('Failed to sync member update:', error);
                continue;
            }
        }

        localStorage.removeItem('pendingMemberUpdates');
        console.log('Pending member updates synced successfully');

    } catch (error) {
        console.error('Background sync failed for members:', error);
    }
}

// Placeholder functions for actual sync implementation
async function syncScoreUpdate(update) {
    // Implementation would depend on Firebase setup
    console.log('Syncing score update:', update);
}

async function syncMemberUpdate(update) {
    // Implementation would depend on Firebase setup
    console.log('Syncing member update:', update);
}

// Handle push notifications (if implemented)
self.addEventListener('push', event => {
    console.log('Push notification received:', event);

    if (!event.data) {
        return;
    }

    const data = event.data.json();

    const options = {
        body: data.body || 'New notification',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: data.data || {},
        actions: data.actions || [],
        requireInteraction: data.requireInteraction || false
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'West Cairo Region', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);

    event.notification.close();

    const { action, data } = event;

    let url = '/';

    if (data && data.url) {
        url = data.url;
    } else if (action === 'view-dashboard') {
        url = '/#dashboard';
    } else if (action === 'view-leaderboard') {
        url = '/#leaderboard';
    }

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            // Check if app is already open
            for (const client of clientList) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }

            // Open new window if app is not open
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});

// Error handling
self.addEventListener('error', event => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('Service Worker unhandled rejection:', event.reason);
});
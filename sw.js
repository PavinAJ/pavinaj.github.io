// sw.js - Service Worker for PavinTech PWA
// Manufacturing Professional Portfolio - Offline Capability

const CACHE_NAME = 'pavintech-v1.2.0';
const STATIC_CACHE_NAME = 'pavintech-static-v1.2.0';
const DYNAMIC_CACHE_NAME = 'pavintech-dynamic-v1.2.0';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/services/',
  '/tools/',
  '/games/',
  '/courses/',
  '/jobs/',
  '/manifest.json',
  
  // External CDN resources (critical ones)
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
  'https://unpkg.com/aos@next/dist/aos.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// Dynamic content patterns
const DYNAMIC_PATTERNS = [
  /^https:\/\/pavintech\.com\/games\/.*$/,
  /^https:\/\/fonts\.gstatic\.com\/.*$/,
  /^https:\/\/unpkg\.com\/.*$/,
  /^https:\/\/cdnjs\.cloudflare\.com\/.*$/
];

// Analytics and ads (network-first strategy)
const NETWORK_FIRST_PATTERNS = [
  /^https:\/\/www\.googletagmanager\.com\/.*$/,
  /^https:\/\/www\.google-analytics\.com\/.*$/,
  /^https:\/\/pagead2\.googlesyndication\.com\/.*$/
];

// ===============================================
// INSTALL EVENT
// ===============================================

self.addEventListener('install', (event) => {
  console.log('PavinTech Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('PavinTech Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('PavinTech Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('PavinTech Service Worker: Installation failed', error);
      })
  );
});

// ===============================================
// ACTIVATE EVENT
// ===============================================

self.addEventListener('activate', (event) => {
  console.log('PavinTech Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName.startsWith('pavintech-')) {
              console.log('PavinTech Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('PavinTech Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// ===============================================
// FETCH EVENT - CACHING STRATEGIES
// ===============================================

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  // Network First Strategy for Analytics and Ads
  if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(event.request.url))) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // Cache First Strategy for Static Assets
  if (requestUrl.origin === location.origin || 
      event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com') ||
      event.request.url.includes('cdnjs.cloudflare.com') ||
      event.request.url.includes('unpkg.com')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // Stale While Revalidate for Dynamic Content
  if (DYNAMIC_PATTERNS.some(pattern => pattern.test(event.request.url))) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  
  // Default: Network First
  event.respondWith(networkFirst(event.request));
});

// ===============================================
// CACHING STRATEGIES
// ===============================================

// Cache First Strategy - Good for static assets
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('PavinTech Service Worker: Cache first failed', error);
    return getOfflineFallback(request);
  }
}

// Network First Strategy - Good for dynamic content
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('PavinTech Service Worker: Network failed, trying cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return getOfflineFallback(request);
  }
}

// Stale While Revalidate - Good for frequently updated content
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // If network fails, we already have cached response
    return cachedResponse;
  });
  
  return cachedResponse || fetchPromise;
}

// ===============================================
// OFFLINE FALLBACKS
// ===============================================

async function getOfflineFallback(request) {
  const url = new URL(request.url);
  
  // Return appropriate offline page based on request
  if (request.headers.get('accept').includes('text/html')) {
    // For HTML requests, return cached homepage or offline page
    const cachedHome = await caches.match('/');
    if (cachedHome) {
      return cachedHome;
    }
    
    // Create basic offline page
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Offline - PavinTech</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center; 
            padding: 50px 20px; 
            color: #1a365d; 
            background: #f8fafc;
          }
          .container { max-width: 600px; margin: 0 auto; }
          .icon { font-size: 4rem; margin-bottom: 2rem; }
          h1 { color: #1a365d; margin-bottom: 1rem; }
          p { color: #64748b; margin-bottom: 2rem; line-height: 1.6; }
          .btn {
            background: #2d7dd2;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">⚙️</div>
          <h1>You're Offline</h1>
          <p>It looks like you've lost your internet connection. Don't worry - some features of PavinTech are still available offline.</p>
          <p>Check your connection and try again, or browse the cached pages.</p>
          <a href="/" class="btn" onclick="window.location.reload()">Try Again</a>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // For other requests, return a basic error response
  return new Response('Offline', { 
    status: 503, 
    statusText: 'Service Unavailable' 
  });
}

// ===============================================
// BACKGROUND SYNC (Future Enhancement)
// ===============================================

self.addEventListener('sync', (event) => {
  console.log('PavinTech Service Worker: Background sync', event.tag);
  
  if (event.tag === 'background-analytics') {
    event.waitUntil(syncAnalytics());
  }
  
  if (event.tag === 'contact-form') {
    event.waitUntil(syncContactForm());
  }
});

async function syncAnalytics() {
  console.log('PavinTech Service Worker: Syncing analytics data');
}

async function syncContactForm() {
  console.log('PavinTech Service Worker: Syncing contact form data');
}

// ===============================================
// PUSH NOTIFICATIONS (Future Enhancement)
// ===============================================

self.addEventListener('push', (event) => {
  console.log('PavinTech Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update from PavinTech',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/assets/icons/action-view.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/icons/action-close.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('PavinTech', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// ===============================================
// PERIODIC BACKGROUND SYNC (Future Enhancement)
// ===============================================

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  console.log('PavinTech Service Worker: Updating cache in background');
  
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    await cache.addAll(STATIC_ASSETS);
    console.log('PavinTech Service Worker: Cache updated successfully');
  } catch (error) {
    console.error('PavinTech Service Worker: Cache update failed', error);
  }
}

// ===============================================
// CACHE MANAGEMENT
// ===============================================

// Clean up old caches and limit cache size
async function cleanupCaches() {
  const cacheWhitelist = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
  const cacheNames = await caches.keys();
  
  return Promise.all(
    cacheNames.map((cacheName) => {
      if (!cacheWhitelist.includes(cacheName)) {
        console.log('PavinTech Service Worker: Deleting cache', cacheName);
        return caches.delete(cacheName);
      }
    })
  );
}

// Limit dynamic cache size
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Run cache cleanup periodically
setInterval(() => {
  limitCacheSize(DYNAMIC_CACHE_NAME, 50);
}, 300000); // Every 5 minutes

console.log('PavinTech Service Worker: Loaded successfully');

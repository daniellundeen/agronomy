// agronomy.info Service Worker
// Caches the app shell for offline use. API calls (Open-Meteo) still require network.

const CACHE_NAME = 'agronomy-info-v1';

// App shell files to cache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/emergence-calculator',
  '/corn-gdu-tracker',
  '/soybean-gdu-tracker',
  '/rainfall-tracker_7',
  '/corn-irrigation-coach',
  '/gdu-rain-report',
  '/corn-replant-calculator',
  'https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap',
];

// Install: cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can; don't fail install if external fonts are blocked
      return Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - App shell (same-origin HTML/JS/CSS): Cache-first, network fallback
// - Open-Meteo API calls: Network-first, no cache (need fresh data)
// - Everything else: Network-first, cache fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Open-Meteo and other weather APIs → always network
  if (url.hostname.includes('open-meteo.com') ||
      url.hostname.includes('api.weather') ||
      url.hostname.includes('geocoding')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell → cache-first
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Cache successful same-origin responses
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // Offline fallback: serve index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
    );
    return;
  }

  // External resources → network-first with cache fallback
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});

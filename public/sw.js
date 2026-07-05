// public/sw.js - Service Worker

const CACHE_NAME = 'translator-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Lưu file Tesseract.js vào cache
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
const TESSERACT_WORKER_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/worker.min.js';
const TESSERACT_CORE_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core.wasm.js';

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching assets...');
        return cache.addAll([
          ...ASSETS,
          TESSERACT_URL,
          TESSERACT_WORKER_URL,
          TESSERACT_CORE_URL,
        ]);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch strategy: Cache first, then network
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Tesseract.js files - cache first
  if (url.hostname.includes('cdn.jsdelivr.net') && 
      url.pathname.includes('tesseract')) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            console.log('📦 Serving Tesseract from cache');
            return cached;
          }
          return fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
            return response;
          });
        })
    );
    return;
  }

  // API requests - network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Offline fallback
          return new Response(
            JSON.stringify({ error: 'Offline - Please connect to internet' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        });
      })
  );
});
const CACHE_NAME = 'literature-v1';
const PRECACHE_MANIFEST_URL = '/precache-manifest.json';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const response = await fetch(PRECACHE_MANIFEST_URL);
        const manifest = await response.json();

        await Promise.all(
          manifest.map(async ({ url, revision }) => {
            const cacheUrl = revision ? `${url}?rev=${revision}` : url;
            try {
              const res = await fetch(cacheUrl);
              if (res.ok) {
                const cleanResponse = new Response(await res.blob(), {
                  status: res.status,
                  statusText: res.statusText,
                  headers: res.headers,
                });
                await cache.put(url, cleanResponse);
              }
            } catch (err) {
              console.warn(`SW: Failed to precache ${url}`, err);
            }
          })
        );
      } catch (err) {
        console.error('SW: Failed to load precache manifest', err);
      }

      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
      self.clients.claim();
      console.log('SW: Activated and old caches cleaned.');
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok && networkResponse.type === 'basic') {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        if (event.request.mode === 'navigate') {
          const fallback = await cache.match('/index.html');
          if (fallback) return fallback;
        }
        throw err;
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
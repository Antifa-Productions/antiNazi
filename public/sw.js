/**
 * Service Worker — precaches assets from precache-manifest.json
 * with cache-first for static assets and network-first for
 * navigation requests.
 */

// ── Constants ─────────────────────────────────────────────────────

const CACHE_NAME = 'literature-v1';
const PRECACHE_MANIFEST_URL = '/precache-manifest.json';
const FALLBACK_URL = '/index.html';
const isDev = !self.location.hostname.includes('prod');

// ── Logging ───────────────────────────────────────────────────────

const logger = {
  log: (msg, data = null) => {
    if (isDev) console.log(`[SW] ${msg}`, data ?? '');
  },
  warn: (msg, err = null) => {
    console.warn(`[SW] ⚠️  ${msg}`, jj        `Manifest fetch failed: ${response.status} ${response.statusText}`
      );
    }
    return await response.json();
  } catch (err) {
    logger.error(`Failed to load precache manifest from ${PRECACHE_MANIFEST_URL}`, err);
    return [];
  }
}

async function precacheAsset(entry, cache) {
  const { url, revision } = entry;
  const cacheUrl = revision ? `${url}?rev=${revision}` : url;

  try {
    const response = await fetch(cacheUrl);

    if (!response.ok) {
      logger.warn(`Precache: ${url} returned ${response.status}, skipping`);
      return;
    }

    const cloned = response.clone();
    const cleanedResponse = new Response(await cloned.blob(), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    await cache.put(url, cleanedResponse);
    logger.log(`Precached: ${url}`);
  } catch (err) {
    logger.warn(`Failed to precache ${url}`, err);
  }
}

async function precacheAssets(manifest) {
  const cache = await caches.open(CACHE_NAME);
  const tasks = manifest.map(entry => precacheAsset(entry, cache));
  const results = await Promise.allSettled(tasks);
  const failures = results.filter(r => r.status === 'rejected').length;

  if (failures > 0) {
    logger.warn(`Precaching completed with ${failures} failure(s)`);
  } else {
    logger.log(`Successfully precached ${manifest.length} asset(s)`);
  }
}

// ── Cache cleanup ──────────────────────────────────────────────────

async function cleanOldCaches() {
  try {
    const keys = await caches.keys();
    const oldKeys = keys.filter(key => key !== CACHE_NAME);

    if (oldKeys.length === 0) {
      logger.log('No old caches to clean');
      return;
    }

    await Promise.all(oldKeys.map(key => caches.delete(key)));
    logger.log(`Cleaned ${oldKeys.length} old cache(s)`);
  } catch (err) {
    logger.error('Failed to clean old caches', err);
  }
}

// ── Fetch strategies ───────────────────────────────────────────────

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isCacheableResponse(response) {
  return (
    response.ok &&
    (response.type === 'basic' || response.type === 'cors')
  );
}

async function fetchWithFallback(request, fallbackUrl = null) {
  try {
    const response = await fetch(request);

    if (!isNavigationRequest(request) && isCacheableResponse(response)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    logger.warn(`Network request failed for ${request.url}`, err);

    if (fallbackUrl) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const fallbackResponse = await cache.match(fallbackUrl);
        if (fallbackResponse) {
          logger.log(`Using fallback: ${fallbackUrl}`);
          return fallbackResponse;
        }
      } catch (fallbackErr) {
        logger.error(`Fallback also failed for ${fallbackUrl}`, fallbackErr);
      }
    }

    throw err;
  }
}

async function handleFetch(request) {
  const cache = await caches.open(CACHE_NAME);

  // Navigation: network-first, fall back to cached HTML
  if (isNavigationRequest(request)) {
    try {
      return await fetchWithFallback(request, FALLBACK_URL);
    } catch (err) {
      const cached = await cache.match(FALLBACK_URL);
      if (cached) return cached;
      throw err;
    }
  }

  // Static assets: cache-first
  const cached = await cache.match(request);
  if (cached) {
    logger.log(`Cache hit: ${request.url}`);
    return cached;
  }

  return fetchWithFallback(request);
}

// ── Lifecycle events ───────────────────────────────────────────────

self.addEventListener('install', (event) => {
  logger.log('Installing...');

  event.waitUntil(
    (async () => {
      try {
        const manifest = await fetchPrecacheManifest();
        await precacheAssets(manifest);
        self.skipWaiting();
        logger.log('Install complete, skipping waiting');
      } catch (err) {
        logger.error('Install failed', err);
        throw err;
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  logger.log('Activating...');

  event.waitUntil(
    (async () => {
      await cleanOldCaches();
      await self.clients.claim();
      logger.log('Activation complete');
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(handleFetch(request));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    logger.log('Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

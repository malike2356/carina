const CACHE = 'carina-ws-v4';

const WORKSPACE_SHELLS = [
  '/',
  '/workspace',
  '/notes',
  '/calendar',
  '/documents',
  '/images',
  '/email',
  '/memory',
  '/kanban',
  '/webhooks',
  '/packs',
  '/prompt-packs',
  '/playbook',
  '/cookbook',
  '/compare',
  '/research',
  '/manifest.json',
  '/icon.svg',
  '/workspace-prefs.js',
  '/notes.js',
  '/documents.js',
  '/images.js',
  '/email.js',
  '/calendar.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => {
        // Add shells one by one so a single 404 does not abort everything
        return Promise.allSettled(
          WORKSPACE_SHELLS.map((url) => cache.add(url).catch(() => null)),
        );
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API and ACP: network-first, offline JSON stub on failure
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/acp/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response('{"error":"offline"}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    return;
  }

  // Cross-origin: pass through
  if (url.origin !== self.location.origin) return;

  // Workspace shells and static assets: cache-first, network fallback with cache update
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});

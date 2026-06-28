const CACHE_NAME = 'carina-cloud-v9';
const PRECACHE_URLS = ['/offline', '/manifest.webmanifest', '/icon.svg'];
const IMMUTABLE_PREFIXES = ['/_next/static/', '/_next/image'];
const AIVA_HOSTS = new Set(['admin.hireaiva.co.uk', 'aiva.carinaai.uk']);

function isAivaHost() {
  return AIVA_HOSTS.has(self.location.hostname);
}

self.addEventListener('install', (event) => {
  if (isAivaHost()) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  if (isAivaHost()) {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => self.registration.unregister()),
    );
    return;
  }
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (isAivaHost()) return;

  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) return;
  if (IMMUTABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;
  if (url.pathname.startsWith('/themes/')) return;

  if (request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(async () => {
      const offline = await caches.match('/offline');
      return (
        offline
        ?? new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      );
    }),
  );
});

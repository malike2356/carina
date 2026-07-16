/**
 * Minimal service worker served on Aiva product hosts instead of the cloud PWA worker.
 * Must NOT call registration.unregister() inside activate; that races browser update()
 * and throws InvalidStateError ("script Unknown").
 *
 * Nginx copy: core.carinaai.uk/docker/nginx/hireaiva.co.uk.conf (admin.hireaiva.co.uk /sw.js)
 */
export const AIVA_SERVICE_WORKER_KILL_SCRIPT = `
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});
`.trim();

/** Minified body for nginx `return 200 '...'` on admin.hireaiva.co.uk */
export const AIVA_SERVICE_WORKER_KILL_SCRIPT_MINIFIED =
  'self.addEventListener("install",function(){self.skipWaiting()});self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});';

export const AIVA_SERVICE_WORKER_KILL_HEADERS: Record<string, string> = {
  'Content-Type': 'application/javascript; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Service-Worker-Allowed': '/',
};

/** Installable Aiva PWA manifest (standalone). Nginx may mirror this on Aiva hosts. */
export const AIVA_MINIMAL_MANIFEST_BODY = JSON.stringify({
  name: 'Aiva',
  short_name: 'Aiva',
  description: 'Hire and manage AI employees for your business.',
  display: 'standalone',
  start_url: '/aiva/workers',
  scope: '/',
  background_color: '#0f1117',
  theme_color: '#22c55e',
  icons: [
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ],
});

export const AIVA_MINIMAL_MANIFEST_HEADERS: Record<string, string> = {
  'Content-Type': 'application/manifest+json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

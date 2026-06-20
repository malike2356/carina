# Web UI Upgrade 06; Odysseus PWA Support

> **REUSE RULE:** See `../REUSE-RULES.md`. File name references the behavioral source only. All implementation must use Carina's own voice, naming, CLI output, and UI copy. No competitor brand names in any shipped file.


**Source:** Odysseus (`static/sw.js`, `static/manifest.json`, PWA architecture)
**Status:** Missing in Carina web UI
**Effort:** 1 week

---

## SPECIFICATION

### What This Is

Odysseus ships as a Progressive Web App (PWA). Users can install it to their home screen, use it offline, and receive push notifications. The PWA uses a service worker for caching and offline support.

Carina should ship as a PWA for mobile and desktop install.

---

## IMPLEMENTATION

### 1. Manifest.json

Create `app.carinaai.uk/public/manifest.json`:

```json
{
  "name": "Carina",
  "short_name": "Carina",
  "description": "Your AI workspace; chat, research, documents, email, and more",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d1117",
  "theme_color": "#0d1117",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/chat.png",
      "sizes": "1280x800",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Chat with Carina"
    },
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "1280x800",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Workspace dashboard"
    }
  ],
  "categories": ["productivity", "utilities"],
  "shortcuts": [
    {
      "name": "New Chat",
      "short_name": "Chat",
      "description": "Start a new conversation",
      "url": "/chat",
      "icons": [{ "src": "/icons/chat.png", "sizes": "96x96" }]
    },
    {
      "name": "Dashboard",
      "url": "/dashboard",
      "icons": [{ "src": "/icons/dashboard.png", "sizes": "96x96" }]
    }
  ],
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

**Study reference:** `odysseus/static/manifest.json`

### 2. Service Worker

Create `app.carinaai.uk/public/sw.js`:

```javascript
// Carina Service Worker
const CACHE_NAME = 'carina-v1';
const OFFLINE_URL = '/offline';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests: network-only (don't cache)
  if (url.pathname.startsWith('/api/')) {
    return; // Let browser handle normally
  }

  // Static assets: cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|svg|woff2?|ico)$/) ||
    url.pathname.startsWith('/_next/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // HTML pages: network-first with offline fallback
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match(OFFLINE_URL);
        });
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    data: { url: data.url || '/' },
    actions: data.actions || [],
    tag: data.tag || 'carina-notification',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // If a window is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
```

**Study reference:** `odysseus/static/sw.js`

### 3. PWA Registration

Create `app.carinaai.uk/src/lib/pwa-registration.ts`:

```typescript
// lib/pwa-registration.ts
'use client';

export function registerPWA() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Register service worker
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    console.log('SW registered:', reg.scope);

    // Check for updates
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          showUpdateNotification();
        }
      });
    });
  });

  // Listen for install prompt
  let deferredPrompt: any;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install button
    showInstallButton();
  });

  // Listen for successful install
  window.addEventListener('appinstalled', () => {
    hideInstallButton();
    deferredPrompt = null;
  });
}

function showInstallButton() {
  // Dispatch custom event for UI
  window.dispatchEvent(new CustomEvent('pwa-install-available'));
}

function hideInstallButton() {
  window.dispatchEvent(new CustomEvent('pwa-install-hidden'));
}

function showUpdateNotification() {
  // Show "New version available; refresh?" toast
  window.dispatchEvent(new CustomEvent('pwa-update-available'));
}
```

### 4. PWA Install Prompt Component

```tsx
// components/PwaInstallBanner.tsx
'use client';

import { useEffect, useState } from 'react';

export function PwaInstallBanner() {
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setShowInstall(false));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!showInstall) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstall(false);
    }
  };

  return (
    <div className="pwa-install-banner">
      <span> Install Carina for quick access</span>
      <div className="flex gap-2">
        <button onClick={handleInstall}>Install</button>
        <button onClick={() => setShowInstall(false)}>Dismiss</button>
      </div>
    </div>
  );
}
```

### 5. Offline Page

Create `app.carinaai.uk/src/app/offline/page.tsx`:

```tsx
// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div className="offline-container">
      <div className="offline-content">
        <h1> You're offline</h1>
        <p>Carina requires an internet connection to process your requests.</p>
        <p>Your messages will be queued and sent when you reconnect.</p>
        <button onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </div>
  );
}
```

### 6. Layout Integration

Add to root `layout.tsx`:

```tsx
// app/layout.tsx
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { registerPWA } from '@/lib/pwa-registration';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d1117" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Carina" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `(${registerPWA.toString()})()` }} />
      </head>
      <body>
        <PwaInstallBanner />
        {children}
      </body>
    </html>
  );
}
```

---

## IMPLEMENTATION PLAN

### Day 1-2; Foundation
```
- Create manifest.json with icons
- Create service worker (sw.js)
- Create offline page
- Add PWA registration script
- Add meta tags to root layout
```

### Day 3-4; Install Experience
```
- Create PwaInstallBanner component
- Handle beforeinstallprompt event
- Handle appinstalled event
- Test install flow on mobile and desktop
```

### Day 5; Polish
```
- Add share_target for system share sheet integration
- Add app shortcuts in manifest
- Add screenshots for install dialog
- Add update notification for new service worker versions
- Test offline fallback
```

---

## REFERENCE FILES

```
Odysseus:
  odysseus/static/sw.js; service worker
  odysseus/static/manifest.json; PWA manifest
  odysseus/static/login.html; offline-aware login

Carina Mobile (reuse):
  carinaMobile/src/lib/widget-sync.ts; widget registration
  carinaMobile/src/lib/notifications.ts; notification handling
```
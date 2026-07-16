'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { InstallPromptBanner } from './InstallPromptBanner';
import { useProductSurfaceContext } from './ProductSurfaceProvider';

const AUTH_PATH_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password'];

const WORKSPACE_PATH_PREFIXES = [
  '/launcher',
  '/dashboard',
  '/chat',
  '/settings',
  '/billing',
  '/aiva',
  '/onboarding',
  '/conversations',
  '/channels',
  '/terminal',
];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function PwaBootstrap() {
  const pathname = usePathname();
  const productSurface = useProductSurfaceContext();
  // Only offer install on public marketing paths; workspace routes use the browser menu.
  const showInstallPrompt =
    productSurface === 'cloud'
    && Boolean(pathname)
    && pathname === '/'
    && !isAuthPath(pathname)
    && !isWorkspacePath(pathname);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (productSurface === 'aiva') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length === 0) return null;
        return navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      }).then((registration) => {
        if (registration) return registration.update();
      }).catch(() => {});
      return;
    }

    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      void registration.update();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(() => {});

    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || sessionStorage.getItem('carina-sw-reloaded') === '1') return;
      reloaded = true;
      sessionStorage.setItem('carina-sw-reloaded', '1');
      window.location.reload();
    });
  }, [productSurface]);

  return showInstallPrompt ? <InstallPromptBanner /> : null;
}

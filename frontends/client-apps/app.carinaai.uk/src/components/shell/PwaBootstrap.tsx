'use client';

import { useEffect } from 'react';
import { InstallPromptBanner } from './InstallPromptBanner';

export function PwaBootstrap() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

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
  }, []);

  return <InstallPromptBanner />;
}

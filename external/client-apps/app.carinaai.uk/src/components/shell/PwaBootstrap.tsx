'use client';

import { useEffect } from 'react';
import { InstallPromptBanner } from './InstallPromptBanner';

export function PwaBootstrap() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return <InstallPromptBanner />;
}

'use client';

import { useEffect, useState } from 'react';
import {
  APPEARANCE_DEFAULTS,
  type AppearanceSettings,
  normalizeAppearance,
} from '@/lib/appearance';

export function useAppearance(): AppearanceSettings {
  const [settings, setSettings] = useState<AppearanceSettings>(APPEARANCE_DEFAULTS);

  useEffect(() => {
    function handleAppearanceChanged(event: Event) {
      setSettings(normalizeAppearance((event as CustomEvent).detail));
    }

    document.addEventListener('appearance-changed', handleAppearanceChanged);
    return () => document.removeEventListener('appearance-changed', handleAppearanceChanged);
  }, []);

  return settings;
}

import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { installUpdateAndRelaunch, type UpdateInfo } from '../lib/updater.js';

export function useUpdater(): {
  update: UpdateInfo | null;
  dismiss: () => void;
  install: () => Promise<void>;
} {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let active = true;
    void listen<UpdateInfo>('update-available', (event) => {
      if (active) setUpdate(event.payload);
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    update,
    dismiss: () => setUpdate(null),
    install: async () => {
      await installUpdateAndRelaunch();
    },
  };
}

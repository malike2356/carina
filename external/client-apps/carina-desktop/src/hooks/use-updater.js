import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { installUpdateAndRelaunch } from '../lib/updater.js';
export function useUpdater() {
    const [update, setUpdate] = useState(null);
    useEffect(() => {
        let active = true;
        void listen('update-available', (event) => {
            if (active)
                setUpdate(event.payload);
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

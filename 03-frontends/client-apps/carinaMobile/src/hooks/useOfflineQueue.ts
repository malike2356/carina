import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';
import type { QueuedMessage } from '@/api/types';
import { dequeueOfflineMessage, loadOfflineQueue } from '@/lib/offline-queue';

export function useOfflineQueue(
  sendMessage: (text: string, options?: { fromQueue?: boolean }) => Promise<void>,
) {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [flushing, setFlushing] = useState(false);

  const reload = useCallback(async () => {
    setQueue(await loadOfflineQueue());
  }, []);

  const flush = useCallback(async () => {
    const items = await loadOfflineQueue();
    if (items.length === 0) return;

    setFlushing(true);
    try {
      for (const item of items) {
        const state = await NetInfo.fetch();
        if (!state.isConnected) break;
        await sendMessage(item.text, { fromQueue: true });
        await dequeueOfflineMessage(item.id);
      }
    } finally {
      await reload();
      setFlushing(false);
    }
  }, [reload, sendMessage]);

  useEffect(() => {
    void reload();
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void flush();
      }
    });
    return () => unsub();
  }, [flush, reload]);

  return { queue, flushing, reload, flush };
}

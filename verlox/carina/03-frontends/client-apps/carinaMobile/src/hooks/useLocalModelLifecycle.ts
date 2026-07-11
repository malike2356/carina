import { useEffect } from 'react';
import { getCatalogEntry } from '@/config/local-model';
import { initLocalModel, unloadLocalModel } from '@/lib/local-inference';
import { getModelMeta, isModelDownloaded } from '@/lib/local-model-manager';
import { getActiveLocalModelId, isLocalModelEnabled } from '@/store/local-model-store';

export function useLocalModelLifecycle(): void {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const enabled = await isLocalModelEnabled();
      if (!enabled || cancelled) return;
      const activeId = await getActiveLocalModelId();
      const downloaded = await isModelDownloaded(activeId);
      if (!downloaded || cancelled) return;
      const meta = await getModelMeta(activeId);
      const entry = getCatalogEntry(activeId);
      if (!meta || !entry || cancelled) return;
      await initLocalModel(meta.filePath, entry);
    })();

    return () => {
      cancelled = true;
      void unloadLocalModel();
    };
  }, []);
}

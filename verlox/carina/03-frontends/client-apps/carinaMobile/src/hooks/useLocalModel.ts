import { useCallback, useEffect, useState } from 'react';
import {
  LOCAL_MODEL_CATALOG,
  getCatalogEntry,
  requireCatalogEntry,
  type LocalModelCatalogEntry,
  type LocalModelId,
} from '@/config/local-model';
import {
  getLoadedLocalModelDisplayName,
  getLoadedLocalModelId,
  initLocalModel,
  isLocalModelReady,
  probeLocalInferenceNative,
  unloadLocalModel,
} from '@/lib/local-inference';
import {
  cancelModelDownload,
  deleteModel,
  downloadModel,
  getDownloadProgress,
  getModelMeta,
  isModelDownloaded,
  listDownloadedModelIds,
  type DownloadProgress,
} from '@/lib/local-model-manager';
import {
  getActiveLocalModelId,
  isAutoDownloadEnabled,
  isLocalModelEnabled,
  isWifiOnlyDownload,
  setActiveLocalModelId,
  setAutoDownloadEnabled,
  setLocalModelEnabled,
  setWifiOnlyDownload,
} from '@/store/local-model-store';

export interface CatalogModelState {
  entry: LocalModelCatalogEntry;
  downloaded: boolean;
  active: boolean;
}

export function useLocalModel() {
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>(getDownloadProgress());
  const [isReady, setIsReady] = useState(isLocalModelReady());
  const [downloadedIds, setDownloadedIds] = useState<LocalModelId[]>([]);
  const [activeId, setActiveId] = useState<LocalModelId | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [modelName, setModelName] = useState<string | null>(null);
  const [nativeOk, setNativeOk] = useState(true);
  const [nativeReason, setNativeReason] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    const probe = await probeLocalInferenceNative();
    setNativeOk(probe.ok);
    setNativeReason(probe.reason ?? null);

    const [ids, enabledState, autoState, wifiState, active] = await Promise.all([
      listDownloadedModelIds(),
      isLocalModelEnabled(),
      isAutoDownloadEnabled(),
      isWifiOnlyDownload(),
      getActiveLocalModelId(),
    ]);
    setDownloadedIds(ids);
    setEnabled(enabledState);
    setAutoDownload(autoState);
    setWifiOnly(wifiState);
    setActiveId(active);

    const activeDownloaded = ids.includes(active);
    if (probe.ok && enabledState && activeDownloaded) {
      const meta = await getModelMeta(active);
      const entry = getCatalogEntry(active);
      if (meta && entry) {
        const ok = await initLocalModel(meta.filePath, entry);
        setIsReady(ok && isLocalModelReady());
        setModelName(ok ? getLoadedLocalModelDisplayName() : null);
      } else {
        setIsReady(false);
        setModelName(null);
      }
    } else {
      if (!enabledState || !probe.ok) {
        await unloadLocalModel();
      }
      setIsReady(false);
      setModelName(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (loading || !autoDownload) return;
    if (downloadedIds.length > 0) return;
    if (downloadProgress.state === 'downloading' || downloadProgress.state === 'verifying') return;
    void (async () => {
      const id = activeId ?? (await getActiveLocalModelId());
      const ok = await downloadModel((progress) => setDownloadProgress({ ...progress }), {
        wifiOnly,
        modelId: id,
      });
      if (ok) await refreshState();
    })();
  }, [
    loading,
    autoDownload,
    downloadedIds.length,
    downloadProgress.state,
    activeId,
    wifiOnly,
    refreshState,
  ]);

  const startDownload = useCallback(
    async (modelId?: LocalModelId) => {
      const id = modelId ?? activeId ?? (await getActiveLocalModelId());
      setDownloadProgress({
        state: 'downloading',
        modelId: id,
        bytesDownloaded: 0,
        totalBytes: requireCatalogEntry(id).expectedSizeBytes,
      });
      const ok = await downloadModel((progress) => setDownloadProgress({ ...progress }), {
        wifiOnly,
        modelId: id,
      });
      if (ok) {
        await refreshState();
      }
    },
    [activeId, wifiOnly, refreshState],
  );

  const removeModel = useCallback(
    async (modelId?: LocalModelId) => {
      const id = modelId ?? activeId ?? (await getActiveLocalModelId());
      if (activeDownloadIs(id)) {
        await cancelModelDownload();
      }
      if (getLoadedLocalModelId() === id) {
        await unloadLocalModel();
      }
      await deleteModel(id);
      setDownloadProgress(getDownloadProgress());
      await refreshState();
    },
    [activeId, refreshState],
  );

  const selectModel = useCallback(
    async (modelId: LocalModelId) => {
      await setActiveLocalModelId(modelId);
      setActiveId(modelId);
      const downloaded = await isModelDownloaded(modelId);
      if (!downloaded || !(await isLocalModelEnabled())) {
        await unloadLocalModel();
        setIsReady(false);
        setModelName(null);
        return;
      }
      const meta = await getModelMeta(modelId);
      const entry = requireCatalogEntry(modelId);
      if (!meta) return;
      const ok = await initLocalModel(meta.filePath, entry);
      setIsReady(ok && isLocalModelReady());
      setModelName(ok ? entry.displayName : null);
    },
    [],
  );

  const toggleEnabled = useCallback(
    async (value: boolean) => {
      await setLocalModelEnabled(value);
      setEnabled(value);
      if (!value) {
        await unloadLocalModel();
        setIsReady(false);
        setModelName(null);
        return;
      }
      await refreshState();
    },
    [refreshState],
  );

  const toggleAutoDownload = useCallback(async (value: boolean) => {
    await setAutoDownloadEnabled(value);
    setAutoDownload(value);
  }, []);

  const toggleWifiOnly = useCallback(async (value: boolean) => {
    await setWifiOnlyDownload(value);
    setWifiOnly(value);
  }, []);

  const catalog: CatalogModelState[] = LOCAL_MODEL_CATALOG.map((entry) => ({
    entry,
    downloaded: downloadedIds.includes(entry.id),
    active: activeId === entry.id,
  }));

  return {
    loading,
    downloadProgress,
    isReady,
    nativeOk,
    nativeReason,
    downloaded: downloadedIds.length > 0,
    downloadedIds,
    activeId,
    catalog,
    enabled,
    autoDownload,
    wifiOnly,
    modelName,
    startDownload,
    deleteModel: removeModel,
    selectModel,
    cancelDownload: () => void cancelModelDownload().then(() => setDownloadProgress(getDownloadProgress())),
    refreshState,
    toggleEnabled,
    toggleAutoDownload,
    toggleWifiOnly,
  };
}

function activeDownloadIs(modelId: LocalModelId): boolean {
  const progress = getDownloadProgress();
  return (
    progress.modelId === modelId &&
    (progress.state === 'downloading' || progress.state === 'verifying')
  );
}

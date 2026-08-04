import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import {
  DEFAULT_LOCAL_MODEL_ID,
  getCatalogEntry,
  requireCatalogEntry,
  type LocalModelCatalogEntry,
  type LocalModelId,
} from '@/config/local-model';
import { getActiveLocalModelId, setActiveLocalModelId } from '@/store/local-model-store';

/** Legacy single-model meta key (pre-catalog). */
const LEGACY_META_KEY = 'carina.local-model';
const META_MAP_KEY = 'carina.local-model.catalog-meta';
const MODELS_DIR = `${FileSystem.documentDirectory ?? ''}models/`;

export type DownloadState =
  | 'not_started'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'error';

export interface DownloadProgress {
  state: DownloadState;
  modelId?: LocalModelId;
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
}

export interface LocalModelMeta {
  modelId: LocalModelId;
  filePath: string;
  fileSizeBytes: number;
  sha256: string;
  downloadedAt: string;
  version: number;
}

type MetaMap = Partial<Record<LocalModelId, LocalModelMeta>>;

let currentProgress: DownloadProgress = {
  state: 'not_started',
  bytesDownloaded: 0,
  totalBytes: 0,
};

let activeDownload: FileSystem.DownloadResumable | null = null;
let activeDownloadModelId: LocalModelId | null = null;
let migratePromise: Promise<void> | null = null;

export function getDownloadProgress(): DownloadProgress {
  return currentProgress;
}

function setProgress(progress: DownloadProgress): void {
  currentProgress = progress;
}

async function ensureModelsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  }
}

async function readMetaMap(): Promise<MetaMap> {
  await migrateLegacyMetaIfNeeded();
  const raw = await AsyncStorage.getItem(META_MAP_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as MetaMap;
  } catch {
    return {};
  }
}

async function writeMetaMap(map: MetaMap): Promise<void> {
  await AsyncStorage.setItem(META_MAP_KEY, JSON.stringify(map));
}

async function migrateLegacyMetaIfNeeded(): Promise<void> {
  if (migratePromise) {
    await migratePromise;
    return;
  }
  migratePromise = (async () => {
    const existing = await AsyncStorage.getItem(META_MAP_KEY);
    if (existing) return;

    const legacyRaw = await AsyncStorage.getItem(LEGACY_META_KEY);
    if (!legacyRaw) return;

    try {
      const legacy = JSON.parse(legacyRaw) as LocalModelMeta;
      const entry = getCatalogEntry(legacy.modelId) ?? getCatalogEntry('gemma-2-2b-it-q4km');
      if (!entry || !legacy.filePath) return;
      const migrated: LocalModelMeta = {
        modelId: entry.id,
        filePath: legacy.filePath,
        fileSizeBytes: legacy.fileSizeBytes,
        sha256: legacy.sha256 || entry.sha256,
        downloadedAt: legacy.downloadedAt || new Date().toISOString(),
        version: entry.version,
      };
      await writeMetaMap({ [entry.id]: migrated });
      await setActiveLocalModelId(entry.id);
      await AsyncStorage.removeItem(LEGACY_META_KEY);
    } catch {
      // ignore corrupt legacy meta
    }
  })();
  await migratePromise;
}

async function verifyModelFile(
  filePath: string,
  entry: LocalModelCatalogEntry,
): Promise<void> {
  const info = await FileSystem.getInfoAsync(filePath);
  if (!info.exists || !info.size) {
    throw new Error('Model file missing after download');
  }

  const sizeDelta = Math.abs(info.size - entry.expectedSizeBytes);
  const tolerance = entry.expectedSizeBytes * 0.08;
  if (sizeDelta > tolerance) {
    throw new Error(`Model file size mismatch (${info.size} bytes)`);
  }

  // Full-file SHA256 of multi-GB GGUF in JS would exhaust device memory.
  // Size validation runs above; pin sha256 when native chunked verify ships.
}

export async function getModelMeta(modelId?: LocalModelId): Promise<LocalModelMeta | null> {
  const id = modelId ?? (await getActiveLocalModelId());
  const map = await readMetaMap();
  return map[id] ?? null;
}

export async function listDownloadedModelIds(): Promise<LocalModelId[]> {
  const map = await readMetaMap();
  const ids: LocalModelId[] = [];
  for (const [id, meta] of Object.entries(map) as Array<[LocalModelId, LocalModelMeta]>) {
    const entry = getCatalogEntry(id);
    if (!entry || !meta?.filePath || meta.version !== entry.version) continue;
    const info = await FileSystem.getInfoAsync(meta.filePath);
    if (info.exists && info.size) ids.push(id);
  }
  return ids;
}

export async function isModelDownloaded(modelId?: LocalModelId): Promise<boolean> {
  const id = modelId ?? (await getActiveLocalModelId());
  const meta = await getModelMeta(id);
  const entry = getCatalogEntry(id);
  if (!meta || !entry || meta.version !== entry.version) return false;
  const info = await FileSystem.getInfoAsync(meta.filePath);
  return Boolean(info.exists && info.size);
}

export async function deleteModel(modelId?: LocalModelId): Promise<void> {
  const id = modelId ?? (await getActiveLocalModelId());
  if (activeDownloadModelId === id) {
    activeDownload?.pauseAsync().catch(() => undefined);
    activeDownload = null;
    activeDownloadModelId = null;
  }

  const map = await readMetaMap();
  const meta = map[id];
  if (meta?.filePath) {
    await FileSystem.deleteAsync(meta.filePath, { idempotent: true });
  }
  delete map[id];
  await writeMetaMap(map);

  const active = await getActiveLocalModelId();
  if (active === id) {
    const remaining = Object.keys(map) as LocalModelId[];
    await setActiveLocalModelId(remaining[0] ?? DEFAULT_LOCAL_MODEL_ID);
  }

  if (activeDownloadModelId == null) {
    setProgress({
      state: 'not_started',
      bytesDownloaded: 0,
      totalBytes: 0,
    });
  }
}

export async function downloadModel(
  onProgress: (progress: DownloadProgress) => void,
  options?: { wifiOnly?: boolean; modelId?: LocalModelId },
): Promise<boolean> {
  const id = options?.modelId ?? (await getActiveLocalModelId());
  const entry = requireCatalogEntry(id);
  const destPath = `${MODELS_DIR}${entry.filename}`;

  if (activeDownload) {
    const error = 'Another model download is already in progress';
    const failed: DownloadProgress = {
      state: 'error',
      modelId: id,
      bytesDownloaded: 0,
      totalBytes: entry.expectedSizeBytes,
      error,
    };
    setProgress(failed);
    onProgress(failed);
    return false;
  }

  if (options?.wifiOnly) {
    const state = await Network.getNetworkStateAsync();
    if (state.type !== Network.NetworkStateType.WIFI) {
      const error = 'Wi-Fi required for model download';
      const failed: DownloadProgress = {
        state: 'error',
        modelId: id,
        bytesDownloaded: 0,
        totalBytes: entry.expectedSizeBytes,
        error,
      };
      setProgress(failed);
      onProgress(failed);
      return false;
    }
  }

  await ensureModelsDir();
  const map = await readMetaMap();
  const existing = map[id];
  if (existing?.filePath && existing.version !== entry.version) {
    await FileSystem.deleteAsync(existing.filePath, { idempotent: true });
    delete map[id];
    await writeMetaMap(map);
  }

  setProgress({
    state: 'downloading',
    modelId: id,
    bytesDownloaded: 0,
    totalBytes: entry.expectedSizeBytes,
  });
  onProgress(currentProgress);

  const callback = (data: FileSystem.DownloadProgressData) => {
    const next: DownloadProgress = {
      state: 'downloading',
      modelId: id,
      bytesDownloaded: data.totalBytesWritten,
      totalBytes: data.totalBytesExpectedToWrite || entry.expectedSizeBytes,
    };
    setProgress(next);
    onProgress(next);
  };

  activeDownloadModelId = id;
  activeDownload = FileSystem.createDownloadResumable(entry.url, destPath, {}, callback);

  try {
    const result = await activeDownload.downloadAsync();
    if (!result?.uri) {
      throw new Error('Download did not complete');
    }

    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    const fileSize =
      fileInfo.exists && 'size' in fileInfo && typeof fileInfo.size === 'number'
        ? fileInfo.size
        : currentProgress.bytesDownloaded;

    const verifying: DownloadProgress = {
      state: 'verifying',
      modelId: id,
      bytesDownloaded: fileSize,
      totalBytes: fileSize,
    };
    setProgress(verifying);
    onProgress(verifying);

    await verifyModelFile(result.uri, entry);

    const meta: LocalModelMeta = {
      modelId: entry.id,
      filePath: result.uri,
      fileSizeBytes: fileSize,
      sha256: entry.sha256,
      downloadedAt: new Date().toISOString(),
      version: entry.version,
    };
    const nextMap = await readMetaMap();
    nextMap[id] = meta;
    await writeMetaMap(nextMap);
    await setActiveLocalModelId(id);

    const ready: DownloadProgress = {
      state: 'ready',
      modelId: id,
      bytesDownloaded: fileSize,
      totalBytes: fileSize,
    };
    setProgress(ready);
    onProgress(ready);
    activeDownload = null;
    activeDownloadModelId = null;
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failed: DownloadProgress = {
      state: 'error',
      modelId: id,
      bytesDownloaded: currentProgress.bytesDownloaded,
      totalBytes: currentProgress.totalBytes,
      error: msg,
    };
    setProgress(failed);
    onProgress(failed);
    activeDownload = null;
    activeDownloadModelId = null;
    return false;
  }
}

export async function cancelModelDownload(): Promise<void> {
  if (activeDownload) {
    await activeDownload.pauseAsync();
    activeDownload = null;
    activeDownloadModelId = null;
  }
  setProgress({
    state: 'not_started',
    bytesDownloaded: 0,
    totalBytes: 0,
  });
}

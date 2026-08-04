import { describe, expect, it, vi, beforeEach } from 'vitest';

const storage = new Map<string, string>();
const files = new Map<string, { exists: boolean; size?: number }>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

vi.mock('expo-file-system', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: vi.fn(async (path: string) => {
    if (path.endsWith('models/')) {
      return { exists: true, size: 0 };
    }
    const entry = files.get(path);
    if (entry) return entry;
    if (path.includes('Llama-3.2-1B')) {
      return { exists: true, size: 807_694_464 };
    }
    if (path.includes('gemma')) {
      return { exists: true, size: 1_629_000_000 };
    }
    return { exists: false };
  }),
  makeDirectoryAsync: vi.fn(async (path: string) => {
    files.set(path, { exists: true });
  }),
  deleteAsync: vi.fn(async (path: string) => {
    files.delete(path);
  }),
  createDownloadResumable: vi.fn((_url: string, dest: string) => ({
    downloadAsync: vi.fn(async () => {
      const size = dest.includes('Llama')
        ? 807_694_464
        : dest.includes('Qwen')
          ? 1_120_000_000
          : 1_629_000_000;
      files.set(dest, { exists: true, size });
      return {
        uri: dest,
        status: 200,
        headers: {},
        mimeType: 'application/octet-stream',
      };
    }),
    pauseAsync: vi.fn(async () => undefined),
  })),
}));

vi.mock('expo-network', () => ({
  getNetworkStateAsync: vi.fn(async () => ({ type: 'WIFI' })),
  NetworkStateType: { WIFI: 'WIFI', CELLULAR: 'CELLULAR' },
}));

describe('local-model-manager', () => {
  beforeEach(() => {
    storage.clear();
    files.clear();
    vi.resetModules();
  });

  it('downloads catalog model and marks it ready', async () => {
    const { downloadModel, isModelDownloaded, getModelMeta } = await import('./local-model-manager');

    let lastState = '';
    const ok = await downloadModel(
      (progress) => {
        lastState = progress.state;
      },
      { modelId: 'llama-3.2-1b-instruct-q4km' },
    );

    expect(ok).toBe(true);
    expect(lastState).toBe('ready');
    await expect(isModelDownloaded('llama-3.2-1b-instruct-q4km')).resolves.toBe(true);
    const meta = await getModelMeta('llama-3.2-1b-instruct-q4km');
    expect(meta?.modelId).toBe('llama-3.2-1b-instruct-q4km');
  });

  it('migrates legacy gemma meta into the catalog map', async () => {
    storage.set(
      'carina.local-model',
      JSON.stringify({
        modelId: 'gemma-2-2b-it-q4km',
        filePath: 'file:///docs/models/gemma-2-2b-it-Q4_K_M.gguf',
        fileSizeBytes: 1_629_000_000,
        sha256: '',
        downloadedAt: '2026-01-01T00:00:00.000Z',
        version: 1,
      }),
    );
    files.set('file:///docs/models/gemma-2-2b-it-Q4_K_M.gguf', {
      exists: true,
      size: 1_629_000_000,
    });

    const { isModelDownloaded, getModelMeta, listDownloadedModelIds } = await import(
      './local-model-manager'
    );
    await expect(isModelDownloaded('gemma-2-2b-it-q4km')).resolves.toBe(true);
    const meta = await getModelMeta('gemma-2-2b-it-q4km');
    expect(meta?.filePath).toContain('gemma');
    await expect(listDownloadedModelIds()).resolves.toContain('gemma-2-2b-it-q4km');
  });
});

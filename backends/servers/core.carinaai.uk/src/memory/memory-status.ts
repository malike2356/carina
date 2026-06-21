import { getMemoryBackend } from './backends/index.js';
import { resolveSurface } from '../product/surface-capabilities.js';

export interface MemoryStatus {
  available: boolean;
  backend: 'postgres' | 'sqlite' | 'file' | 'cloud-db' | 'none';
  episodic: boolean;
  persistent: boolean;
  injectInChat: boolean;
  reason?: string;
}

function mapBackendName(name: string): MemoryStatus['backend'] {
  if (name === 'postgres') return 'postgres';
  if (name === 'sqlite') return 'sqlite';
  if (name === 'builtin') return 'file';
  if (name === 'cloud-db') return 'cloud-db';
  return 'none';
}

export async function getMemoryStatus(opts?: {
  platform?: string;
  workspaceId?: string;
  memoryReady?: boolean;
}): Promise<MemoryStatus> {
  void opts?.workspaceId;
  const platform = opts?.platform ?? 'cli';
  const memoryReady = opts?.memoryReady ?? false;
  const surface = resolveSurface({
    platform,
    hostedMode: process.env.HOSTED_MODE === 'true',
    coreProxy: process.env.CARINA_USE_CORE_PROXY === 'true',
  });

  if (surface === 'cloud-byok' || surface === 'cloud-core-proxy') {
    const coreProxy = surface === 'cloud-core-proxy';
    return {
      available: true,
      backend: 'cloud-db',
      episodic: coreProxy,
      persistent: coreProxy,
      injectInChat: true,
      reason: coreProxy
        ? undefined
        : 'Workspace DB memories only; full episodic memory needs core proxy.',
    };
  }

  if (!memoryReady) {
    return {
      available: false,
      backend: 'none',
      episodic: false,
      persistent: false,
      injectInChat: false,
      reason: 'Memory backend is not ready on this install.',
    };
  }

  const backend = getMemoryBackend();
  if (!backend.isConfigured()) {
    return {
      available: false,
      backend: 'none',
      episodic: false,
      persistent: false,
      injectInChat: false,
      reason: `${backend.displayName} is not configured.`,
    };
  }

  const mapped = mapBackendName(backend.name);
  const episodic = backend.name !== 'builtin';

  return {
    available: true,
    backend: mapped,
    episodic,
    persistent: episodic,
    injectInChat: true,
  };
}

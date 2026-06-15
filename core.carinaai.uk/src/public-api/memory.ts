// STABLE API: changes require semver major bump and docs/kernel/STABLE_API.md update.

export type { MemoryBackend, MemoryBackendName } from '../memory/backends/types.js';
export {
  getMemoryBackend,
  listMemoryBackends,
  describeMemoryBackends,
  setMemoryBackend,
  initMemoryBackend,
} from '../memory/backends/index.js';

export const MEMORY_API_VERSION = '0.2.0';

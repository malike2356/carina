export {
  DEFAULT_CONFIG,
  DEFAULT_MANIFEST,
  type GithubBridgeConfig,
  type GithubBridgeManifest,
  type GithubBridgeProduct,
  type GithubBridgeSearchHit,
  type GithubBridgeStatus,
  type SyncCycleResult,
} from './types.js';

export {
  contentLooksSecret,
  isDeniedPath,
  isUnderAllowedFolder,
  isWritablePath,
  looksLikeEphemeralWorkingMemory,
  shouldCommitFile,
} from './policy.js';

export {
  loadConfig,
  saveConfig,
  loadToken,
  saveToken,
  hasToken,
  loadManifest,
  resolveClonePath,
} from './config.js';

export {
  getStatus,
  updateSettings,
  pullNow,
  pushApprovedDurableUpdates,
  writeDurableNote,
  searchSharedKnowledge,
  rebuildIndex,
  runFullSyncCycle,
} from './service.js';

export { startGithubBridgeSchedule, stopGithubBridgeSchedule } from './scheduler.js';

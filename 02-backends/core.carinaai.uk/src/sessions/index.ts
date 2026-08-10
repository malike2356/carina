export {
  TIER_DEFAULTS,
  resolveSessionConfig,
  type SessionTier,
  type ConcurrentLimitPolicy,
  type SessionConfig,
  type DeviceInfo,
  type AuthSession,
  type ValidationResult,
  type RevocationReason,
  type RevocationLogEntry,
  type NewDeviceLoginEvent,
} from './types.js';

export {
  enforceConcurrentLimit,
  getConcurrentCount,
  setMaxConcurrent,
  getMaxConcurrent,
  clearProjectLimitsForTests,
} from './concurrent-limiter.js';

export {
  revokeSession,
  revokeAllSessions,
  revokeOnPasswordChange,
  revokeOnRoleChange,
  getRevocationLog,
  appendRevocationLog,
} from './revocation.js';

export {
  MemorySessionStore,
  getDefaultSessionStore,
  resetDefaultSessionStore,
  type SessionStore,
} from './session-store.js';

export { SessionManager, createSessionManager } from './session-manager.js';

export { parseDeviceInfo, formatNewLoginMessage } from './device-info.js';

// UI lives in session-ui.tsx (React). Import that file directly from frontends.

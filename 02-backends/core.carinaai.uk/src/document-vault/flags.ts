/**
 * Document Vault feature flags (prompt 707).
 * Defaults keep legacy stores authoritative until 708+ cutover.
 */

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export type DocumentVaultFlags = {
  /** Canonical vault service routing (off until 708 lands). */
  v1Enabled: boolean;
  /** Keep legacy adapters/routes callable. */
  compatAdapters: boolean;
  /** Write to vault and legacy during migration window. */
  dualWrite: boolean;
  /** Inventory/migration reports never mutate when true. */
  migrateDryRun: boolean;
  /** Allow retiring legacy stores after cutover evidence. */
  retireLegacyStores: boolean;
  /** Channel / Telegram Document Vault ops (prompt 713). Default on. */
  channelOps: boolean;
  /** Search / RAG / ops plane (prompt 714). Default on. */
  searchOps: boolean;
};

export function documentVaultFlags(): DocumentVaultFlags {
  return {
    v1Enabled: envFlag('DOCUMENT_VAULT_V1_ENABLED', false),
    compatAdapters: envFlag('DOCUMENT_VAULT_COMPAT_ADAPTERS', true),
    dualWrite: envFlag('DOCUMENT_VAULT_DUAL_WRITE', false),
    migrateDryRun: envFlag('DOCUMENT_VAULT_MIGRATE_DRY_RUN', true),
    retireLegacyStores: envFlag('DOCUMENT_VAULT_RETIRE_LEGACY_STORES', false),
    channelOps: envFlag('DOCUMENT_VAULT_CHANNEL_OPS', true),
    searchOps: envFlag('DOCUMENT_VAULT_SEARCH_OPS', true),
  };
}

/** Rollback is allowed when legacy routes remain available. */
export function documentVaultRollbackSafe(flags: DocumentVaultFlags = documentVaultFlags()): boolean {
  if (flags.retireLegacyStores) return false;
  if (!flags.compatAdapters) return false;
  return true;
}

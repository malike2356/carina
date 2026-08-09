import { loadTenantWorkspaceConfig, listTenantWorkspaceConfigs } from '../hosted/tenant-workspace-config.js';

function parsePilotWorkspaceIds(): ReadonlySet<string> {
  const raw = process.env.EMAIL_INGESTION_PILOT_WORKSPACE_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter((id) => id.length > 0),
  );
}

let cachedPilotIds: ReadonlySet<string> | null = null;
let cachedWorkspaceGateIds: ReadonlySet<string> | null = null;
let cachedWorkspaceGateLoaded = false;

export function emailIngestionPilotWorkspaceIds(): ReadonlySet<string> {
  if (!cachedPilotIds) cachedPilotIds = parsePilotWorkspaceIds();
  return cachedPilotIds;
}

/** Clear cached pilot IDs (tests only). */
export function resetEmailIngestionPilotCache(): void {
  cachedPilotIds = null;
  cachedWorkspaceGateIds = null;
  cachedWorkspaceGateLoaded = false;
}

export function isEmailIngestionEnabled(): boolean {
  return process.env.EMAIL_INGESTION_ENABLED === 'true';
}

function loadWorkspaceGateIds(): ReadonlySet<string> {
  if (cachedWorkspaceGateLoaded && cachedWorkspaceGateIds) return cachedWorkspaceGateIds;
  const ids = new Set<string>();
  for (const config of listTenantWorkspaceConfigs()) {
    if (config.emailIngestionEnabled) {
      ids.add(config.tenantId.trim().toLowerCase());
    }
  }
  cachedWorkspaceGateIds = ids;
  cachedWorkspaceGateLoaded = true;
  return ids;
}

/** True when global flag is on, workspace is in the pilot allowlist, or workspace config gate is on. */
export function isEmailIngestionEnabledForWorkspace(workspaceId: string | null | undefined): boolean {
  if (isEmailIngestionEnabled()) return true;
  if (!workspaceId?.trim()) return false;
  const normalized = workspaceId.trim().toLowerCase();
  if (emailIngestionPilotWorkspaceIds().has(normalized)) return true;
  if (loadWorkspaceGateIds().has(normalized)) return true;
  try {
    return loadTenantWorkspaceConfig(normalized).emailIngestionEnabled;
  } catch {
    return false;
  }
}

/** True when any workspace may use Carina IMAP ingestion (global, pilot list, or tenant config). */
export function isEmailIngestionActive(): boolean {
  return isEmailIngestionEnabled()
    || emailIngestionPilotWorkspaceIds().size > 0
    || loadWorkspaceGateIds().size > 0;
}

export function isPropreneurBridgeEnabled(): boolean {
  return process.env.PROPREENEUR_BRIDGE_ENABLED === 'true';
}

export function isPropreneurBridgeWritesEnabled(): boolean {
  return process.env.PROPREENEUR_BRIDGE_WRITES === 'true';
}

export function isAivaDailySummaryEnabled(): boolean {
  return process.env.AIVA_DAILY_SUMMARY_ENABLED === 'true';
}

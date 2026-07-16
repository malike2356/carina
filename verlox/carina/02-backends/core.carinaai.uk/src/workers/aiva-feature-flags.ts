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

export function emailIngestionPilotWorkspaceIds(): ReadonlySet<string> {
  if (!cachedPilotIds) cachedPilotIds = parsePilotWorkspaceIds();
  return cachedPilotIds;
}

/** Clear cached pilot IDs (tests only). */
export function resetEmailIngestionPilotCache(): void {
  cachedPilotIds = null;
}

export function isEmailIngestionEnabled(): boolean {
  return process.env.EMAIL_INGESTION_ENABLED === 'true';
}

/** True when global flag is on, or workspace is in the pilot allowlist. */
export function isEmailIngestionEnabledForWorkspace(workspaceId: string | null | undefined): boolean {
  if (isEmailIngestionEnabled()) return true;
  if (!workspaceId?.trim()) return false;
  return emailIngestionPilotWorkspaceIds().has(workspaceId.trim().toLowerCase());
}

/** True when any workspace may use Carina IMAP ingestion (global or pilot list). */
export function isEmailIngestionActive(): boolean {
  return isEmailIngestionEnabled() || emailIngestionPilotWorkspaceIds().size > 0;
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

/**
 * Google Recorder → Aiva ingestion config.
 * Path A: poll recorder.google.com every 15 minutes (no public API).
 */

export function isGoogleRecorderIngestionEnabled(): boolean {
  return process.env.AIVA_GOOGLE_RECORDER_ENABLED === 'true';
}

export function googleRecorderPilotWorkspaceIds(): ReadonlySet<string> {
  const raw = process.env.AIVA_GOOGLE_RECORDER_PILOT_WORKSPACE_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter((id) => id.length > 0),
  );
}

export function isGoogleRecorderEnabledForWorkspace(workspaceId: string | null | undefined): boolean {
  if (isGoogleRecorderIngestionEnabled()) return true;
  if (!workspaceId?.trim()) return false;
  return googleRecorderPilotWorkspaceIds().has(workspaceId.trim().toLowerCase());
}

export function isGoogleRecorderActive(): boolean {
  return isGoogleRecorderIngestionEnabled() || googleRecorderPilotWorkspaceIds().size > 0;
}

/** Default: every 15 minutes. */
export function googleRecorderPollCronExpression(): string {
  return process.env.AIVA_GOOGLE_RECORDER_POLL_CRON?.trim() || '*/15 * * * *';
}

export function googleRecorderPollLimit(): number {
  const n = Number(process.env.AIVA_GOOGLE_RECORDER_POLL_LIMIT ?? 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 10;
}

export function googleRecorderHeadless(): boolean {
  return process.env.AIVA_GOOGLE_RECORDER_HEADLESS !== 'false';
}

/** When set, poller reads JSON fixtures instead of opening Playwright (tests / dry-run). */
export function googleRecorderFixtureDir(): string | null {
  const raw = process.env.AIVA_GOOGLE_RECORDER_FIXTURE_DIR?.trim();
  return raw || null;
}

export const GOOGLE_RECORDER_URL = 'https://recorder.google.com/';

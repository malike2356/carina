import { isScoutMutualIntegrationActive } from '../scout-mode.js';
import { scoutComplianceSyncEnabled } from '../compliance/scout-sync.js';
import { syncAllFrameworkEvidenceToScout, remediateStaleEvidenceIfNeeded } from './compliance-collector.js';
import { getPolicyVersionState } from './policy-tracker.js';
import { reportEvent } from '../scout-client.js';
import { config } from '../../config/index.js';

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function scoutSyncIntervalMs(): number {
  const raw = process.env.CARINA_SCOUT_SYNC_INTERVAL_MS;
  if (!raw) return DEFAULT_INTERVAL_MS;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : DEFAULT_INTERVAL_MS;
}

export function scoutSyncEnabled(): boolean {
  if (!isScoutMutualIntegrationActive()) return false;
  if (process.env.CARINA_SCOUT_SYNC === 'false') return false;
  return scoutComplianceSyncEnabled();
}

export async function runScoutSyncCycle(): Promise<void> {
  if (!scoutSyncEnabled()) return;

  try {
    await remediateStaleEvidenceIfNeeded();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-sync] Remediation skipped:', msg);
  }

  const policy = getPolicyVersionState();
  await reportEvent({
    severity: 'info',
    source: 'carina-core',
    event_type: 'scout_sync_cycle',
    description: 'Periodic ScoutSync compliance evidence push',
    instance_id: config.labyrinth.instanceId,
    metadata: {
      policyVersion: policy.version,
      sandboxMode: policy.sandboxMode,
    },
  });

  const result = await syncAllFrameworkEvidenceToScout();
  if (result.inserted > 0) {
    console.log(
      `[scout-sync] pushed ${result.inserted} evidence row(s) for ${result.frameworks.join(', ')}`,
    );
  }
  if (result.errors.length > 0) {
    console.warn(`[scout-sync] sync notes: ${result.errors.join('; ')}`);
  }
}

export function startScoutSyncScheduler(): () => void {
  if (!scoutSyncEnabled()) return () => {};
  if (syncTimer) return () => stopScoutSyncScheduler();

  void runScoutSyncCycle();
  syncTimer = setInterval(() => {
    void runScoutSyncCycle();
  }, scoutSyncIntervalMs());

  console.log(`[scout-sync] scheduled every ${Math.round(scoutSyncIntervalMs() / 60_000)} minutes`);
  return stopScoutSyncScheduler;
}

export function stopScoutSyncScheduler(): void {
  if (!syncTimer) return;
  clearInterval(syncTimer);
  syncTimer = null;
}

export function _resetScoutSyncSchedulerForTests(): void {
  stopScoutSyncScheduler();
}

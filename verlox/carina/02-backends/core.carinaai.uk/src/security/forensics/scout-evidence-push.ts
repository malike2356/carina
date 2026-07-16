import { config } from '../../config/index.js';
import { reportEvent } from '../scout-client.js';
import { isScoutMutualIntegrationActive } from '../scout-mode.js';
import { resolveScoutConsoleSyncConfig } from '../compliance/scout-sync.js';
import type { ForensicSnapshot } from './types.js';

export type ScoutForensicPushResult = {
  ok: boolean;
  snapshotId: string;
  pushedVia: 'http' | 'event' | 'skipped';
  error?: string;
};

function artifactSummary(snapshot: ForensicSnapshot): Record<string, unknown> {
  return {
    sessionLog: snapshot.artifacts.sessionLog,
    toolCallLog: snapshot.artifacts.toolCallLog,
    promptLog: snapshot.artifacts.promptLog,
    networkLog: snapshot.artifacts.networkLog,
    memoryDump: snapshot.artifacts.memoryDump,
  };
}

export async function pushForensicSnapshotToScout(
  snapshot: ForensicSnapshot,
  reason: string,
): Promise<ScoutForensicPushResult> {
  if (!isScoutMutualIntegrationActive()) {
    return { ok: true, snapshotId: snapshot.id, pushedVia: 'skipped' };
  }

  const scoutConfig = resolveScoutConsoleSyncConfig();
  const instanceId = config.labyrinth.instanceId;

  if (scoutConfig) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (scoutConfig.apiKey) headers['X-Scout-Key'] = scoutConfig.apiKey;

      const response = await fetch(`${scoutConfig.baseUrl}/api/forensics/evidence/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instance_id: instanceId,
          snapshot_id: snapshot.id,
          incident_id: snapshot.incidentId,
          reason,
          hash: snapshot.hash,
          captured_at: new Date(snapshot.timestamp).toISOString(),
          session_id: snapshot.agentState.sessionId,
          artifacts: artifactSummary(snapshot),
          agent_state: snapshot.agentState,
          security_state: snapshot.securityState,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (response.ok) {
        return { ok: true, snapshotId: snapshot.id, pushedVia: 'http' };
      }

      const text = await response.text();
      console.warn(`[forensics] Scout HTTP push failed (${response.status}): ${text.slice(0, 200)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[forensics] Scout HTTP push error: ${msg}`);
    }
  }

  await reportEvent({
    severity: 'critical',
    source: 'carina-core',
    event_type: 'forensic_snapshot',
    description: reason,
    session_id: snapshot.agentState.sessionId,
    instance_id: instanceId,
    metadata: {
      snapshot_id: snapshot.id,
      incident_id: snapshot.incidentId,
      hash: snapshot.hash,
      captured_at: snapshot.timestamp,
      artifacts: artifactSummary(snapshot),
    },
  });

  return { ok: true, snapshotId: snapshot.id, pushedVia: 'event' };
}

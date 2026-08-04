import { Cron } from 'croner';
import { isAiWorkersEnabled } from '../../workers/workspace-message-handler.js';
import { fetchRecorderListings } from './recorder-browser.js';
import {
  googleRecorderPollCronExpression,
  isGoogleRecorderActive,
  isGoogleRecorderEnabledForWorkspace,
} from './recorder-config.js';
import {
  getGoogleRecorderConnection,
  getGoogleRecorderStorageState,
  listEnabledGoogleRecorderConnections,
  markGoogleRecorderPollResult,
  type GoogleRecorderConnection,
} from './recorder-connection-store.js';
import { ingestRecorderItem } from './recorder-ingest.js';

let pollCron: Cron | null = null;

export async function pollGoogleRecorderConnection(
  connection: GoogleRecorderConnection,
): Promise<{ processed: number; error?: string }> {
  if (!isGoogleRecorderEnabledForWorkspace(connection.workspaceId)) {
    return { processed: 0 };
  }

  const storageState = await getGoogleRecorderStorageState(connection.workerId);
  if (!storageState) {
    await markGoogleRecorderPollResult({
      workerId: connection.workerId,
      seenRecordingIds: connection.seenRecordingIds,
      status: 'needs_reauth',
      error: 'Missing Playwright storageState',
    });
    return { processed: 0, error: 'Missing Playwright storageState' };
  }

  const known = new Set(connection.seenRecordingIds);
  const fetched = await fetchRecorderListings({ storageState, knownIds: known });

  if (!fetched.sessionValid) {
    await markGoogleRecorderPollResult({
      workerId: connection.workerId,
      seenRecordingIds: connection.seenRecordingIds,
      status: 'needs_reauth',
      error: fetched.error ?? 'Session invalid',
    });
    return { processed: 0, error: fetched.error ?? 'Session invalid' };
  }

  if (fetched.error && fetched.items.length === 0) {
    await markGoogleRecorderPollResult({
      workerId: connection.workerId,
      seenRecordingIds: connection.seenRecordingIds,
      status: 'degraded',
      error: fetched.error,
    });
    return { processed: 0, error: fetched.error };
  }

  let processed = 0;
  const seen = [...connection.seenRecordingIds];
  for (const item of fetched.items) {
    try {
      await ingestRecorderItem({
        workerId: connection.workerId,
        workspaceId: connection.workspaceId,
        item,
      });
      seen.push(item.id);
      processed += 1;
    } catch (err) {
      console.warn(
        `[google-recorder] ingest failed for ${item.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  await markGoogleRecorderPollResult({
    workerId: connection.workerId,
    seenRecordingIds: seen,
    status: 'connected',
    error: fetched.error ?? null,
  });

  return { processed };
}

export async function pollAllGoogleRecorderConnections(): Promise<
  Array<{ workerId: string; processed: number; error?: string }>
> {
  if (!isGoogleRecorderActive()) return [];
  const rows = await listEnabledGoogleRecorderConnections();
  const results: Array<{ workerId: string; processed: number; error?: string }> = [];
  for (const row of rows) {
    try {
      const result = await pollGoogleRecorderConnection(row);
      if (result.processed > 0 || result.error) {
        results.push({ workerId: row.workerId, ...result });
      }
    } catch (err) {
      console.warn(`[google-recorder] poll failed for worker ${row.workerId}:`, err);
      results.push({
        workerId: row.workerId,
        processed: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

export async function pollGoogleRecorderWorker(workerId: string): Promise<number> {
  const row = await getGoogleRecorderConnection(workerId);
  if (!row || !row.enabled) return 0;
  const result = await pollGoogleRecorderConnection(row);
  return result.processed;
}

export function startGoogleRecorderPoller(): void {
  if (pollCron || !isAiWorkersEnabled() || !isGoogleRecorderActive()) return;
  const expression = googleRecorderPollCronExpression();
  pollCron = new Cron(expression, { timezone: 'Europe/London' }, () => {
    void pollAllGoogleRecorderConnections()
      .then((results) => {
        const total = results.reduce((sum, item) => sum + item.processed, 0);
        if (total > 0) {
          console.log(`[google-recorder] Ingested ${total} recording(s)`);
        }
      })
      .catch((err) => {
        console.warn('[google-recorder] cycle failed:', err);
      });
  });
  console.log(`[google-recorder] Poller started (${expression})`);
}

export function stopGoogleRecorderPoller(): void {
  pollCron?.stop();
  pollCron = null;
}

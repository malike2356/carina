import { pool } from '../memory/db.js';
import { reportEvent } from './scout-client.js';

export async function enqueueScoutEvent(input: {
  workspaceId: string;
  workerId?: string;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO aiva_scout_event_queue (workspace_id, worker_id, event_type, payload)
     VALUES ($1, $2, $3, $4)`,
    [input.workspaceId, input.workerId ?? null, input.eventType, JSON.stringify(input.payload)],
  );
}

export async function flushQueuedScoutEvents(workspaceId: string): Promise<number> {
  const result = await pool.query(
    `SELECT id, worker_id, event_type, payload
     FROM aiva_scout_event_queue
     WHERE workspace_id = $1 AND flushed_at IS NULL
     ORDER BY created_at ASC
     LIMIT 100`,
    [workspaceId],
  );

  let flushed = 0;
  for (const row of result.rows) {
    try {
      await reportEvent({
        instance_id: row.worker_id ? String(row.worker_id) : undefined,
        event_type: String(row.event_type),
        severity: 'info',
        source: 'aiva-email-handler',
        description: String(row.event_type),
        metadata: {
          workspaceId,
          ...(row.payload as Record<string, unknown>),
        },
      });
      await pool.query(
        'UPDATE aiva_scout_event_queue SET flushed_at = NOW() WHERE id = $1',
        [row.id],
      );
      flushed += 1;
    } catch {
      break;
    }
  }
  return flushed;
}

export async function reportAivaScoutEvent(input: {
  workspaceId: string;
  workerId: string;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await reportEvent({
      instance_id: input.workerId,
      event_type: input.eventType,
      severity: 'info',
      source: 'aiva-email-handler',
      description: input.description,
      metadata: { workspaceId: input.workspaceId, ...input.metadata },
    });
    void import('../integrations/n8n/n8n-webhook-client.js').then(({ emitIlaudN8nEvent }) =>
      emitIlaudN8nEvent({
        eventType: input.eventType,
        workspaceId: input.workspaceId,
        workerId: input.workerId,
        description: input.description,
        metadata: input.metadata,
      }),
    ).catch(() => undefined);
  } catch {
    await enqueueScoutEvent({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      eventType: input.eventType,
      payload: { description: input.description, ...input.metadata },
    });
  }
}

import type { ScoutEvent } from '../security/load-scout-package.js';

let poolPromise: Promise<typeof import('../memory/db.js')> | null = null;

async function db() {
  poolPromise ??= import('../memory/db.js');
  return poolPromise;
}

export async function insertScoutSignalCache(event: ScoutEvent): Promise<void> {
  const agentId = event.instance_id;
  if (!agentId) return;

  try {
    const { pool } = await db();
    await pool.query(
      `INSERT INTO scout_signal_cache (agent_id, event_type, severity, summary, metadata, scout_tx)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        agentId,
        event.event_type,
        event.severity,
        event.description.slice(0, 500),
        JSON.stringify(event.metadata ?? {}),
        typeof event.metadata?.scoutTx === 'string' ? event.metadata.scoutTx : null,
      ],
    );
  } catch {
    // cache is best-effort for admin dashboards
  }
}

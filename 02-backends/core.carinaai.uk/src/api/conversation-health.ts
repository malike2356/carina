/**
 * Ops health for conversation pinning (prompt 01) and contact resolution (prompt 02).
 */
import type { Express, Request, Response } from 'express';
import { authorizeOps } from '../ops/ops-auth.js';
import { isDatabaseConfigured } from '../config/database-url.js';
import { pool } from '../memory/db.js';
import { listUnresolvedContacts } from '../memory/aiva/contact-normalizer.js';
import { ensureConversationPinningSchema } from '../memory/aiva/conversation-pinner.js';
import { getWorkerById } from '../workers/worker-store.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function conversationHealthHandler(req: Request, res: Response): Promise<void> {
  const workerId = String(req.params.workerId ?? '').trim();
  if (!UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Invalid workerId' });
    return;
  }
  const worker = await getWorkerById(workerId).catch(() => null);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  if (!isDatabaseConfigured()) {
    res.json({
      workerId,
      workspaceId: worker.workspaceId,
      conversations: [],
      fragmented: [],
      fragmentationCount: 0,
    });
    return;
  }

  await ensureConversationPinningSchema().catch(() => undefined);

  const conversations = await pool.query<{
    conversation_id: string;
    channel: string;
    contact_id: string;
    last_active: string | null;
    turn_count: string;
    session_id_count: string;
  }>(
    `SELECT
       ct.conversation_id::text AS conversation_id,
       ct.channel,
       ct.contact_id,
       MAX(em.created_at)::text AS last_active,
       COUNT(em.id)::text AS turn_count,
       COUNT(DISTINCT em.session_id)::text AS session_id_count
     FROM channel_threads ct
     LEFT JOIN episodic_memories em
       ON em.conversation_id = ct.conversation_id
     WHERE ct.worker_id = $1
     GROUP BY ct.conversation_id, ct.channel, ct.contact_id
     ORDER BY MAX(em.created_at) DESC NULLS LAST
     LIMIT 200`,
    [workerId],
  ).catch(() => ({ rows: [] as Array<{
    conversation_id: string;
    channel: string;
    contact_id: string;
    last_active: string | null;
    turn_count: string;
    session_id_count: string;
  }> }));

  const fragmented = await pool.query<{
    channel: string;
    contact_id: string;
    conversation_count: string;
    conversation_ids: string;
  }>(
    `SELECT channel, contact_id,
            COUNT(DISTINCT conversation_id)::text AS conversation_count,
            string_agg(DISTINCT conversation_id::text, ',') AS conversation_ids
     FROM channel_threads
     WHERE worker_id = $1
       AND conversation_id IS NOT NULL
     GROUP BY channel, contact_id
     HAVING COUNT(DISTINCT conversation_id) > 1
     ORDER BY COUNT(DISTINCT conversation_id) DESC
     LIMIT 100`,
    [workerId],
  ).catch(() => ({ rows: [] as Array<{
    channel: string;
    contact_id: string;
    conversation_count: string;
    conversation_ids: string;
  }> }));

  res.json({
    workerId,
    workspaceId: worker.workspaceId,
    conversations: conversations.rows.map((row) => ({
      conversationId: row.conversation_id,
      channel: row.channel,
      contactId: row.contact_id,
      lastActive: row.last_active,
      turnCount: Number(row.turn_count) || 0,
      sessionIdCount: Number(row.session_id_count) || 0,
    })),
    fragmented: fragmented.rows.map((row) => ({
      channel: row.channel,
      contactId: row.contact_id,
      conversationCount: Number(row.conversation_count) || 0,
      conversationIds: String(row.conversation_ids ?? '').split(',').filter(Boolean),
    })),
    fragmentationCount: fragmented.rows.length,
  });
}

export function mountConversationHealthRoutes(app: Express): void {
  app.get('/api/ops/contacts/:workerId/unresolved', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const workerId = String(req.params.workerId ?? '').trim();
    if (!UUID_RE.test(workerId)) {
      res.status(400).json({ error: 'Invalid workerId' });
      return;
    }
    const worker = await getWorkerById(workerId).catch(() => null);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const hoursRaw = Number(req.query.hours ?? 24);
    const hours = Number.isFinite(hoursRaw) ? hoursRaw : 24;
    const unresolved = await listUnresolvedContacts({
      workerId,
      workspaceId: worker.workspaceId,
      hours,
    });
    res.json({
      workerId,
      workspaceId: worker.workspaceId,
      hours,
      count: unresolved.length,
      contacts: unresolved,
    });
  });
}

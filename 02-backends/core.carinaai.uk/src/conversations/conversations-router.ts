import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';
import { maskIdentifier } from '../channels/mask-identifier.js';
import { buildConversationThread } from './thread-builder.js';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ConversationRequest = Request & { workspaceId?: string };

type ThreadAccess =
  | { kind: 'ok'; thread: Record<string, unknown> }
  | { kind: 'not_found' }
  | { kind: 'forbidden' };

async function loadThreadForWorkspace(threadId: string, workspaceId: string): Promise<ThreadAccess> {
  const result = await pool.query(
    `SELECT t.*, w.name AS worker_name, w.workspace_id
     FROM channel_threads t
     JOIN ai_workers w ON w.id = t.worker_id
     WHERE t.id = $1`,
    [threadId],
  );
  if (result.rows.length === 0) return { kind: 'not_found' };
  const thread = result.rows[0] as Record<string, unknown>;
  if (String(thread.workspace_id) !== workspaceId) return { kind: 'forbidden' };
  return { kind: 'ok', thread };
}

function respondThreadAccessError(res: Response, access: ThreadAccess): boolean {
  if (access.kind === 'not_found') {
    res.status(404).json({ error: 'Conversation not found' });
    return true;
  }
  if (access.kind === 'forbidden') {
    res.status(403).json({ error: 'Forbidden' });
    return true;
  }
  return false;
}

async function buildThreadExport(thread: Record<string, unknown>, workspaceId: string, threadId: string) {
  const workerId = String(thread.worker_id);
  const channel = String(thread.channel);
  const contactId = String(thread.contact_id);
  const messages = await buildConversationThread({ workerId, channel, contactId });
  const timestamps = messages.map((msg) => msg.timestamp).filter(Boolean);
  const dateRange = timestamps.length > 0
    ? { from: timestamps[0], to: timestamps[timestamps.length - 1] }
    : null;

  return {
    conversationId: threadId,
    workspaceId,
    channel,
    contactId: maskIdentifier(channel, contactId),
    workerName: String(thread.worker_name),
    exportedAt: new Date().toISOString(),
    dateRange,
    messages,
  };
}

async function sendThreadExport(res: Response, thread: Record<string, unknown>, workspaceId: string, threadId: string): Promise<void> {
  const exportPayload = await buildThreadExport(thread, workspaceId, threadId);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="conversation-${threadId}.json"`);
  res.json(exportPayload);
}

function resolveWorkspaceId(req: ConversationRequest): string | null {
  const header = req.headers['x-workspace-id'];
  if (typeof header === 'string' && UUID_RE.test(header)) return header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  return UUID_RE.test(fromQuery) ? fromQuery : null;
}

function requireWorkspace(req: ConversationRequest, res: Response, next: () => void): void {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

export const conversationsRouter: ExpressRouter = Router();
// Tenant isolation: every sibling Aiva router (channels-api, workspace-router,
// aiva-analytics-router, etc.) gates on requireCloudProxy before trusting the
// X-Workspace-Id header. This router was missing that guard, which meant any
// caller who knew or guessed a workspace UUID could list/export another
// tenant's conversations. See docs/production-hardening.md for the audit.
conversationsRouter.use(requireCloudProxy);
conversationsRouter.use(requireWorkspace);

conversationsRouter.get('/analytics/overview', async (req: ConversationRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const days = Math.min(90, Math.max(7, parseInt(String(req.query.days ?? '30'), 10) || 30));
  const since = new Date(Date.now() - days * 86_400_000);

  const [volume, channels, escalations, workers, heatmap] = await Promise.all([
    pool.query(
      `SELECT DATE(a.created_at) AS day, COUNT(*)::int AS messages
       FROM ai_worker_activity a
       JOIN ai_workers w ON w.id = a.worker_id
       WHERE w.workspace_id = $1 AND a.created_at >= $2
       GROUP BY DATE(a.created_at)
       ORDER BY day ASC`,
      [workspaceId, since],
    ),
    pool.query(
      `SELECT t.channel, COUNT(*)::int AS threads, COALESCE(SUM(t.message_count), 0)::int AS messages
       FROM channel_threads t
       JOIN ai_workers w ON w.id = t.worker_id
       WHERE w.workspace_id = $1
       GROUP BY t.channel
       ORDER BY messages DESC`,
      [workspaceId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS open_count
       FROM ai_worker_escalations
       WHERE workspace_id = $1 AND status = 'open'`,
      [workspaceId],
    ),
    pool.query(
      `SELECT w.id, w.name,
              COALESCE(SUM(t.message_count), 0)::int AS messages,
              COUNT(t.id)::int AS threads
       FROM ai_workers w
       LEFT JOIN channel_threads t ON t.worker_id = w.id
       WHERE w.workspace_id = $1 AND w.status != 'dismissed'
       GROUP BY w.id, w.name
       ORDER BY messages DESC`,
      [workspaceId],
    ),
    pool.query(
      `SELECT
         CASE WHEN EXTRACT(DOW FROM a.created_at AT TIME ZONE 'UTC')::int = 0 THEN 6
              ELSE EXTRACT(DOW FROM a.created_at AT TIME ZONE 'UTC')::int - 1 END AS day_of_week,
         EXTRACT(HOUR FROM a.created_at AT TIME ZONE 'UTC')::int AS hour,
         COUNT(*)::int AS count
       FROM ai_worker_activity a
       JOIN ai_workers w ON w.id = a.worker_id
       WHERE w.workspace_id = $1 AND a.created_at >= $2
       GROUP BY 1, 2
       HAVING COUNT(*) > 0`,
      [workspaceId, since],
    ),
  ]);

  const totalMessages = volume.rows.reduce((sum, row) => sum + Number(row.messages), 0);
  const openEscalations = Number(escalations.rows[0]?.open_count ?? 0);

  res.json({
    rangeDays: days,
    totalMessages,
    openEscalations,
    escalationRate: totalMessages > 0 ? openEscalations / totalMessages : 0,
    volumeByDay: volume.rows.map((row) => ({
      date: String(row.day).slice(0, 10),
      messages: Number(row.messages),
    })),
    channelBreakdown: channels.rows.map((row) => ({
      channel: String(row.channel),
      threads: Number(row.threads),
      messages: Number(row.messages),
    })),
    perWorker: workers.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      messages: Number(row.messages),
      threads: Number(row.threads),
    })),
    heatmap: heatmap.rows.map((row) => ({
      dayOfWeek: Number(row.day_of_week),
      hour: Number(row.hour),
      count: Number(row.count),
    })),
  });
});

conversationsRouter.get('/', async (req: ConversationRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const offset = (page - 1) * limit;
  const workerId = typeof req.query.workerId === 'string' && UUID_RE.test(req.query.workerId)
    ? req.query.workerId
    : null;
  const channel = typeof req.query.channel === 'string' ? req.query.channel : null;
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const conditions = ['w.workspace_id = $1'];
  const params: unknown[] = [workspaceId];
  let paramIndex = 2;

  if (workerId) {
    conditions.push(`t.worker_id = $${paramIndex++}`);
    params.push(workerId);
  }
  if (channel) {
    conditions.push(`t.channel = $${paramIndex++}`);
    params.push(channel);
  }
  if (status === 'escalated') {
    conditions.push(`EXISTS (
      SELECT 1 FROM ai_worker_escalations e
      WHERE e.worker_id = t.worker_id AND e.channel_id = t.contact_id
        AND e.status IN ('open', 'assigned', 'in_progress')
    )`);
  } else if (status === 'resolved') {
    conditions.push(`EXISTS (
      SELECT 1 FROM ai_worker_escalations e
      WHERE e.worker_id = t.worker_id AND e.channel_id = t.contact_id AND e.status = 'resolved'
    )`);
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM ai_worker_escalations e
      WHERE e.worker_id = t.worker_id AND e.channel_id = t.contact_id
        AND e.status IN ('open', 'assigned', 'in_progress')
    )`);
  } else if (status === 'open') {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM ai_worker_escalations e
      WHERE e.worker_id = t.worker_id AND e.channel_id = t.contact_id
        AND e.status IN ('open', 'assigned', 'in_progress')
    )`);
  }
  if (search) {
    conditions.push(`(t.contact_id ILIKE $${paramIndex} OR t.thread_metadata::text ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const where = conditions.join(' AND ');
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM channel_threads t
     JOIN ai_workers w ON w.id = t.worker_id
     WHERE ${where}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const listResult = await pool.query(
    `SELECT t.id, t.channel, t.contact_id, t.last_message_at, t.message_count, t.thread_metadata,
            w.id AS worker_id, w.name AS worker_name,
            EXISTS (
              SELECT 1 FROM ai_worker_escalations e
              WHERE e.worker_id = t.worker_id AND e.channel_id = t.contact_id
                AND e.status IN ('open', 'assigned', 'in_progress')
            ) AS has_escalation,
            EXISTS (
              SELECT 1 FROM ai_worker_escalations e
              WHERE e.worker_id = t.worker_id AND e.channel_id = t.contact_id AND e.status = 'resolved'
            ) AS has_resolved
     FROM channel_threads t
     JOIN ai_workers w ON w.id = t.worker_id
     WHERE ${where}
     ORDER BY t.last_message_at DESC NULLS LAST
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset],
  );

  res.json({
    page,
    limit,
    total,
    conversations: listResult.rows.map((row) => {
      const channelName = String(row.channel);
      const contactId = String(row.contact_id);
      const metadata = (row.thread_metadata ?? {}) as Record<string, unknown>;
      const preview = String(metadata.lastPreview ?? metadata.preview ?? '').slice(0, 120);
      const hasEscalation = Boolean(row.has_escalation);
      const hasResolved = Boolean(row.has_resolved);
      let rowStatus: 'open' | 'escalated' | 'resolved' | 'automated' = 'open';
      if (hasEscalation) rowStatus = 'escalated';
      else if (hasResolved) rowStatus = 'resolved';
      return {
        id: String(row.id),
        contactId: maskIdentifier(channelName, contactId),
        channel: channelName,
        worker: { id: String(row.worker_id), name: String(row.worker_name) },
        lastMessageAt: row.last_message_at ? new Date(String(row.last_message_at)).toISOString() : null,
        lastMessagePreview: preview.replace(/\s+/g, ' ').trim(),
        messageCount: Number(row.message_count ?? 0),
        hasEscalation,
        status: rowStatus,
      };
    }),
  });
});

conversationsRouter.get('/:id/thread', async (req: ConversationRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const threadId = String(req.params.id ?? '');
  if (!UUID_RE.test(threadId)) {
    res.status(400).json({ error: 'Invalid conversation id' });
    return;
  }

  const access = await loadThreadForWorkspace(threadId, workspaceId);
  if (respondThreadAccessError(res, access)) return;
  if (access.kind !== 'ok') return;
  const thread = access.thread;
  const workerId = String(thread.worker_id);
  const contactId = String(thread.contact_id);
  const channel = String(thread.channel);
  const startedAt = thread.created_at
    ? new Date(String(thread.created_at)).toISOString()
    : null;

  const messages = await buildConversationThread({ workerId, channel, contactId });

  res.json({
    conversation: {
      id: threadId,
      channel,
      contactId,
      worker: { id: workerId, name: String(thread.worker_name) },
      messageCount: Number(thread.message_count ?? 0),
      startedAt,
    },
    messages,
  });
});

conversationsRouter.get('/:id/export', async (req: ConversationRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const threadId = String(req.params.id ?? '');
  if (!UUID_RE.test(threadId)) {
    res.status(400).json({ error: 'Invalid conversation id' });
    return;
  }

  const access = await loadThreadForWorkspace(threadId, workspaceId);
  if (respondThreadAccessError(res, access)) return;
  if (access.kind !== 'ok') return;
  await sendThreadExport(res, access.thread, workspaceId, threadId);
});

conversationsRouter.get('/:id/export-pdf', async (req: ConversationRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const threadId = String(req.params.id ?? '');
  if (!UUID_RE.test(threadId)) {
    res.status(400).json({ error: 'Invalid conversation id' });
    return;
  }

  const access = await loadThreadForWorkspace(threadId, workspaceId);
  if (respondThreadAccessError(res, access)) return;
  if (access.kind !== 'ok') return;
  await sendThreadExport(res, access.thread, workspaceId, threadId);
});

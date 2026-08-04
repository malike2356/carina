import { pool } from '../memory/db.js';
import { packCredentials, unpackCredentials } from './credential-store.js';
import type { AivaChannelName, WorkerChannelRow } from './types.js';

function rowToChannel(row: Record<string, unknown>): WorkerChannelRow {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    channel: String(row.channel) as AivaChannelName,
    identifier: String(row.identifier),
    credentials: (row.credentials as { encrypted?: string }) ?? {},
    enabled: Boolean(row.enabled ?? true),
    verified: Boolean(row.verified ?? false),
    createdAt: new Date(String(row.connected_at ?? row.created_at ?? Date.now())),
    updatedAt: new Date(String(row.updated_at ?? Date.now())),
  };
}

export async function listWorkspaceChannels(workspaceId: string): Promise<WorkerChannelRow[]> {
  const result = await pool.query(
    `SELECT c.* FROM ai_worker_channels c
     JOIN ai_workers w ON w.id = c.worker_id
     WHERE w.workspace_id = $1
     ORDER BY c.connected_at ASC`,
    [workspaceId],
  );
  return result.rows.map(rowToChannel);
}

export async function listWorkerChannelDetails(workerId: string): Promise<WorkerChannelRow[]> {
  const result = await pool.query(
    'SELECT * FROM ai_worker_channels WHERE worker_id = $1 ORDER BY connected_at ASC',
    [workerId],
  );
  return result.rows.map(rowToChannel);
}

export async function getChannelById(workspaceId: string, channelId: string): Promise<WorkerChannelRow | null> {
  const result = await pool.query(
    `SELECT c.* FROM ai_worker_channels c
     JOIN ai_workers w ON w.id = c.worker_id
     WHERE c.id = $1 AND w.workspace_id = $2`,
    [channelId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return rowToChannel(result.rows[0]);
}

export async function createWorkerChannel(params: {
  workerId: string;
  workspaceId: string;
  channel: AivaChannelName;
  identifier: string;
  credentials?: Record<string, string>;
}): Promise<WorkerChannelRow> {
  const credentials = params.credentials ? packCredentials(params.credentials) : {};
  const existing = await pool.query(
    'SELECT worker_id FROM ai_worker_channels WHERE channel = $1 AND identifier = $2 LIMIT 1',
    [params.channel, params.identifier],
  );
  if (
    existing.rows.length > 0
    && String(existing.rows[0].worker_id) !== params.workerId
  ) {
    throw new Error(`Channel identifier already in use: ${params.channel}:${params.identifier}`);
  }

  const result = await pool.query(
    `INSERT INTO ai_worker_channels
       (worker_id, workspace_id, channel, identifier, credentials, enabled, verified)
     VALUES ($1, $2, $3, $4, $5::jsonb, true, false)
     ON CONFLICT (channel, identifier) DO UPDATE
       SET worker_id = EXCLUDED.worker_id,
           workspace_id = EXCLUDED.workspace_id,
           credentials = EXCLUDED.credentials,
           enabled = true,
           updated_at = NOW()
     RETURNING *`,
    [params.workerId, params.workspaceId, params.channel, params.identifier, JSON.stringify(credentials)],
  );
  return rowToChannel(result.rows[0]);
}

export async function deleteWorkerChannel(workspaceId: string, channelId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM ai_worker_channels c
     USING ai_workers w
     WHERE c.worker_id = w.id AND c.id = $1 AND w.workspace_id = $2
     RETURNING c.id`,
    [channelId, workspaceId],
  );
  return result.rows.length > 0;
}

export async function setChannelEnabled(
  workspaceId: string,
  channelId: string,
  enabled: boolean,
): Promise<WorkerChannelRow | null> {
  const result = await pool.query(
    `UPDATE ai_worker_channels c
     SET enabled = $3, updated_at = NOW()
     FROM ai_workers w
     WHERE c.worker_id = w.id AND c.id = $1 AND w.workspace_id = $2
     RETURNING c.*`,
    [channelId, workspaceId, enabled],
  );
  if (result.rows.length === 0) return null;
  return rowToChannel(result.rows[0]);
}

export async function markChannelVerified(channelId: string): Promise<void> {
  await pool.query(
    `UPDATE ai_worker_channels SET verified = true, updated_at = NOW() WHERE id = $1`,
    [channelId],
  );
}

export async function upsertWorkerChannel(params: {
  workerId: string;
  workspaceId: string;
  channel: AivaChannelName;
  identifier: string;
  credentials: Record<string, string>;
  verified?: boolean;
}): Promise<WorkerChannelRow> {
  const packed = packCredentials(params.credentials);
  const existing = await getWorkerChannelByWorkerAndChannel(params.workerId, params.channel);
  if (existing) {
    const result = await pool.query(
      `UPDATE ai_worker_channels
       SET identifier = $3,
           credentials = $4::jsonb,
           verified = $5,
           enabled = true,
           updated_at = NOW()
       WHERE worker_id = $1 AND channel = $2
       RETURNING *`,
      [
        params.workerId,
        params.channel,
        params.identifier,
        JSON.stringify(packed),
        params.verified ?? false,
      ],
    );
    return rowToChannel(result.rows[0]);
  }

  return createWorkerChannel({
    workerId: params.workerId,
    workspaceId: params.workspaceId,
    channel: params.channel,
    identifier: params.identifier,
    credentials: params.credentials,
  });
}

export async function setChannelVerifiedStatus(channelId: string, verified: boolean): Promise<void> {
  await pool.query(
    `UPDATE ai_worker_channels SET verified = $2, updated_at = NOW() WHERE id = $1`,
    [channelId, verified],
  );
}

export async function listSocialChannelsForRefresh(): Promise<WorkerChannelRow[]> {
  const result = await pool.query(
    `SELECT * FROM ai_worker_channels
     WHERE channel IN ('linkedin', 'instagram', 'messenger', 'twitter', 'tiktok')
       AND enabled = true
       AND credentials ? 'encrypted'
     ORDER BY connected_at ASC`,
  );
  return result.rows.map(rowToChannel);
}

export async function getWorkerChannelByWorkerAndChannel(
  workerId: string,
  channel: AivaChannelName,
): Promise<WorkerChannelRow | null> {
  const result = await pool.query(
    'SELECT * FROM ai_worker_channels WHERE worker_id = $1 AND channel = $2 LIMIT 1',
    [workerId, channel],
  );
  if (result.rows.length === 0) return null;
  return rowToChannel(result.rows[0]);
}

export async function listEnabledChannelRows(): Promise<WorkerChannelRow[]> {
  const result = await pool.query(
    `SELECT * FROM ai_worker_channels WHERE enabled = true ORDER BY connected_at ASC`,
  );
  return result.rows.map(rowToChannel);
}

export async function upsertThread(message: {
  workerId: string;
  workspaceId: string;
  channel: string;
  contactId: string;
  threadId?: string;
  preview?: string;
  emailSubject?: string;
}): Promise<void> {
  const metadata: Record<string, string> = {};
  if (message.threadId) metadata.lastThreadId = message.threadId;
  if (message.preview) metadata.lastPreview = message.preview.slice(0, 120);
  if (message.emailSubject) metadata.lastEmailSubject = message.emailSubject.slice(0, 200);
  await pool.query(
    `INSERT INTO channel_threads
       (worker_id, workspace_id, channel, contact_id, thread_metadata, last_message_at, message_count)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), 1)
     ON CONFLICT (worker_id, channel, contact_id)
     DO UPDATE SET
       last_message_at = NOW(),
       message_count = channel_threads.message_count + 1,
       thread_metadata = channel_threads.thread_metadata || EXCLUDED.thread_metadata`,
    [
      message.workerId,
      message.workspaceId,
      message.channel,
      message.contactId,
      JSON.stringify(metadata),
    ],
  );
}

export async function getThreadEmailSubject(
  workerId: string,
  channel: string,
  contactId: string,
): Promise<string | null> {
  const result = await pool.query(
    `SELECT thread_metadata->>'lastEmailSubject' AS subject
     FROM channel_threads
     WHERE worker_id = $1 AND channel = $2 AND contact_id = $3
     LIMIT 1`,
    [workerId, channel, contactId],
  );
  const subject = result.rows[0]?.subject;
  return subject ? String(subject) : null;
}

export function readChannelCredentials(row: WorkerChannelRow): Record<string, string> {
  return unpackCredentials(row.credentials);
}

export async function mergeWorkerChannelCredentials(
  workerId: string,
  channel: AivaChannelName,
  patch: Record<string, string>,
): Promise<void> {
  const row = await getWorkerChannelByWorkerAndChannel(workerId, channel);
  if (!row) return;
  const current = readChannelCredentials(row);
  await upsertWorkerChannel({
    workerId: row.workerId,
    workspaceId: row.workspaceId,
    channel,
    identifier: row.identifier,
    credentials: { ...current, ...patch },
    verified: row.verified,
  });
}

export function generateEmailSlug(workerName: string, workerId: string, domain?: string): string {
  const resolvedDomain =
    domain
    ?? process.env.AIVA_HOSTED_EMAIL_DOMAIN?.trim().toLowerCase()
    ?? (process.env.NODE_ENV === 'production' ? 'inbox.hireaiva.co.uk' : 'mail.carinaai.uk');
  const base = workerName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20) || 'aiva';
  const suffix = workerId.replace(/-/g, '').slice(0, 6);
  return `${base}-${suffix}@${resolvedDomain}`;
}

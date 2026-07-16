import crypto from 'node:crypto';
import { pool } from '../memory/db.js';
import {
  DEFAULT_SHIELD_POLICY,
  type ShieldChannel,
  type ShieldEnvelope,
  type ShieldMessage,
  type ShieldPolicy,
  type ShieldProtection,
  type ShieldVerdict,
  type QuarantineStatus,
} from './types.js';

function rowToProtection(r: Record<string, unknown>): ShieldProtection {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    channel: r.channel as ShieldChannel,
    externalKey: String(r.external_key),
    mode: r.mode as ShieldProtection['mode'],
    status: r.status as ShieldProtection['status'],
    deliveryTarget: (r.delivery_target_json as Record<string, unknown>) ?? {},
    policy: { ...DEFAULT_SHIELD_POLICY, ...((r.policy_json as ShieldPolicy) ?? {}) },
    scoutRefs: (r.scout_refs_json as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string | Date).toISOString(),
    updatedAt: new Date(r.updated_at as string | Date).toISOString(),
  };
}

function rowToMessage(r: Record<string, unknown>): ShieldMessage {
  return {
    id: String(r.id),
    protectionId: String(r.protection_id),
    workspaceId: String(r.workspace_id),
    channel: r.channel as ShieldChannel,
    externalMessageId: String(r.external_message_id),
    conversationId: String(r.conversation_id),
    envelope: r.envelope_json as ShieldEnvelope,
    rawStorageUri: String(r.raw_storage_uri),
    verdict: (r.verdict as ShieldVerdict | null) ?? null,
    riskScore: Number(r.risk_score ?? 0),
    quarantineStatus: r.quarantine_status as QuarantineStatus,
    safeSummaryText: r.safe_summary_text ? String(r.safe_summary_text) : null,
    stageJson: (r.stage_json as Record<string, unknown>) ?? {},
    scoutEventIds: Array.isArray(r.scout_event_ids_json) ? (r.scout_event_ids_json as string[]) : [],
    deliveredAt: r.delivered_at ? new Date(r.delivered_at as string | Date).toISOString() : null,
    createdAt: new Date(r.created_at as string | Date).toISOString(),
    updatedAt: new Date(r.updated_at as string | Date).toISOString(),
  };
}

/** AES-256-GCM encrypt for raw payload at rest. */
export function encryptAtRest(plaintext: string): string {
  const keyMaterial = process.env.CHANNEL_SHIELD_STORAGE_KEY || 'dev-channel-shield-storage-key-32b';
  const key = crypto.createHash('sha256').update(keyMaterial).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptAtRest(blob: string): string {
  const keyMaterial = process.env.CHANNEL_SHIELD_STORAGE_KEY || 'dev-channel-shield-storage-key-32b';
  const key = crypto.createHash('sha256').update(keyMaterial).digest();
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export async function createProtection(input: {
  workspaceId: string;
  channel: ShieldChannel;
  externalKey: string;
  deliveryTarget?: Record<string, unknown>;
  policy?: Partial<ShieldPolicy>;
}): Promise<ShieldProtection> {
  const policy = { ...DEFAULT_SHIELD_POLICY, ...input.policy };
  const result = await pool.query(
    `INSERT INTO channel_shield_protections (
       workspace_id, channel, external_key, delivery_target_json, policy_json
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (workspace_id, channel, external_key)
     DO UPDATE SET updated_at = now(), status = 'active'
     RETURNING *`,
    [
      input.workspaceId,
      input.channel,
      input.externalKey,
      JSON.stringify(input.deliveryTarget ?? {}),
      JSON.stringify(policy),
    ],
  );
  return rowToProtection(result.rows[0]!);
}

export async function listProtections(workspaceId: string, channel?: ShieldChannel): Promise<ShieldProtection[]> {
  const result = channel
    ? await pool.query(
        `SELECT * FROM channel_shield_protections WHERE workspace_id = $1 AND channel = $2 ORDER BY created_at DESC`,
        [workspaceId, channel],
      )
    : await pool.query(
        `SELECT * FROM channel_shield_protections WHERE workspace_id = $1 ORDER BY created_at DESC`,
        [workspaceId],
      );
  return result.rows.map(rowToProtection);
}

export async function getProtection(id: string): Promise<ShieldProtection | null> {
  const result = await pool.query(`SELECT * FROM channel_shield_protections WHERE id = $1`, [id]);
  return result.rows[0] ? rowToProtection(result.rows[0]) : null;
}

export async function findProtection(
  workspaceId: string,
  channel: ShieldChannel,
  externalKey: string,
): Promise<ShieldProtection | null> {
  const result = await pool.query(
    `SELECT * FROM channel_shield_protections
     WHERE workspace_id = $1 AND channel = $2 AND external_key = $3 LIMIT 1`,
    [workspaceId, channel, externalKey],
  );
  return result.rows[0] ? rowToProtection(result.rows[0]) : null;
}

export async function updateProtection(
  id: string,
  patch: Partial<Pick<ShieldProtection, 'mode' | 'status' | 'deliveryTarget' | 'policy'>>,
): Promise<ShieldProtection | null> {
  const current = await getProtection(id);
  if (!current) return null;
  const result = await pool.query(
    `UPDATE channel_shield_protections SET
       mode = $2,
       status = $3,
       delivery_target_json = $4,
       policy_json = $5,
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      patch.mode ?? current.mode,
      patch.status ?? current.status,
      JSON.stringify(patch.deliveryTarget ?? current.deliveryTarget),
      JSON.stringify(patch.policy ?? current.policy),
    ],
  );
  return result.rows[0] ? rowToProtection(result.rows[0]) : null;
}

export async function insertMessage(input: {
  protection: ShieldProtection;
  envelope: ShieldEnvelope;
  rawCiphertext: string;
}): Promise<ShieldMessage> {
  const result = await pool.query(
    `INSERT INTO channel_shield_messages (
       protection_id, workspace_id, channel, external_message_id, conversation_id,
       envelope_json, raw_storage_uri, raw_ciphertext
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (protection_id, external_message_id) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [
      input.protection.id,
      input.protection.workspaceId,
      input.envelope.channel,
      input.envelope.externalMessageId,
      input.envelope.conversationId,
      JSON.stringify(input.envelope),
      input.envelope.rawStorageUri,
      input.rawCiphertext,
    ],
  );
  return rowToMessage(result.rows[0]!);
}

export async function getMessage(id: string): Promise<ShieldMessage | null> {
  const result = await pool.query(`SELECT * FROM channel_shield_messages WHERE id = $1`, [id]);
  return result.rows[0] ? rowToMessage(result.rows[0]) : null;
}

export async function listMessages(
  workspaceId: string,
  opts: { channel?: ShieldChannel; quarantineOnly?: boolean; limit?: number } = {},
): Promise<ShieldMessage[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const clauses = ['workspace_id = $1'];
  const params: unknown[] = [workspaceId];
  if (opts.channel) {
    params.push(opts.channel);
    clauses.push(`channel = $${params.length}`);
  }
  if (opts.quarantineOnly) {
    clauses.push(`quarantine_status = 'held'`);
  }
  const result = await pool.query(
    `SELECT * FROM channel_shield_messages
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT ${limit}`,
    params,
  );
  return result.rows.map(rowToMessage);
}

export async function updateMessage(
  id: string,
  patch: Partial<{
    verdict: ShieldVerdict;
    riskScore: number;
    quarantineStatus: QuarantineStatus;
    safeSummaryText: string | null;
    stageJson: Record<string, unknown>;
    scoutEventIds: string[];
    deliveredAt: string | null;
  }>,
): Promise<ShieldMessage | null> {
  const current = await getMessage(id);
  if (!current) return null;
  const result = await pool.query(
    `UPDATE channel_shield_messages SET
       verdict = $2,
       risk_score = $3,
       quarantine_status = $4,
       safe_summary_text = $5,
       stage_json = $6,
       scout_event_ids_json = $7,
       delivered_at = $8,
       updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      patch.verdict ?? current.verdict,
      patch.riskScore ?? current.riskScore,
      patch.quarantineStatus ?? current.quarantineStatus,
      patch.safeSummaryText !== undefined ? patch.safeSummaryText : current.safeSummaryText,
      JSON.stringify(patch.stageJson ?? current.stageJson),
      JSON.stringify(patch.scoutEventIds ?? current.scoutEventIds),
      patch.deliveredAt !== undefined
        ? patch.deliveredAt
        : current.deliveredAt,
    ],
  );
  return result.rows[0] ? rowToMessage(result.rows[0]) : null;
}

export async function appendEvent(
  messageId: string,
  actor: string,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO channel_shield_events (message_id, actor, action, detail_json)
     VALUES ($1, $2, $3, $4)`,
    [messageId, actor, action, JSON.stringify(detail)],
  );
}

export async function listEvents(messageId: string) {
  const result = await pool.query(
    `SELECT * FROM channel_shield_events WHERE message_id = $1 ORDER BY created_at ASC`,
    [messageId],
  );
  return result.rows.map((r) => ({
    id: r.id,
    actor: r.actor,
    action: r.action,
    detail: r.detail_json,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function insertAttachments(
  messageId: string,
  attachments: ShieldEnvelope['attachments'],
  staticScan: Record<string, unknown> = {},
): Promise<void> {
  for (const a of attachments) {
    await pool.query(
      `INSERT INTO channel_shield_attachments (
         message_id, filename, content_type, size_bytes, sha256, storage_uri, static_scan_json
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [messageId, a.filename, a.contentType, a.sizeBytes, a.sha256 ?? null, a.storageUri ?? null, JSON.stringify(staticScan)],
    );
  }
}

export async function workspaceShieldMetrics(workspaceId: string): Promise<{
  byChannel: Array<{ channel: string; total: number; held: number; malicious: number }>;
  quarantineDepth: number;
}> {
  const byChannel = await pool.query(
    `SELECT channel,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE quarantine_status = 'held')::int AS held,
            COUNT(*) FILTER (WHERE verdict = 'malicious')::int AS malicious
     FROM channel_shield_messages
     WHERE workspace_id = $1
     GROUP BY channel
     ORDER BY channel`,
    [workspaceId],
  );
  const depth = await pool.query(
    `SELECT COUNT(*)::int AS n FROM channel_shield_messages
     WHERE workspace_id = $1 AND quarantine_status = 'held'`,
    [workspaceId],
  );
  return {
    byChannel: byChannel.rows.map((r) => ({
      channel: String(r.channel),
      total: Number(r.total),
      held: Number(r.held),
      malicious: Number(r.malicious),
    })),
    quarantineDepth: Number(depth.rows[0]?.n ?? 0),
  };
}

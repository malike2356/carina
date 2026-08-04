import { query, tableExists } from './db.js';

export type ShieldChannelMetric = {
  channel: string;
  total: number;
  held: number;
  malicious: number;
  suspect: number;
  clean: number;
  error: number;
};

export type ShieldProtectionRow = {
  id: string;
  workspaceId: string;
  channel: string;
  externalKey: string;
  mode: string;
  status: string;
  updatedAt: string;
};

export async function channelShieldTablesReady(): Promise<boolean> {
  return tableExists('channel_shield_messages');
}

export async function fetchChannelShieldMetrics(): Promise<{
  byChannel: ShieldChannelMetric[];
  quarantineDepth: number;
  protectionCount: number;
  pausedCount: number;
}> {
  const byChannel = await query<{
    channel: string;
    total: string;
    held: string;
    malicious: string;
    suspect: string;
    clean: string;
    error: string;
  }>(
    `SELECT channel,
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE quarantine_status = 'held')::text AS held,
            COUNT(*) FILTER (WHERE verdict = 'malicious')::text AS malicious,
            COUNT(*) FILTER (WHERE verdict = 'suspect')::text AS suspect,
            COUNT(*) FILTER (WHERE verdict = 'clean')::text AS clean,
            COUNT(*) FILTER (WHERE verdict = 'error')::text AS error
     FROM channel_shield_messages
     GROUP BY channel
     ORDER BY channel`,
  );

  const depth = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM channel_shield_messages WHERE quarantine_status = 'held'`,
  );
  const prots = await query<{ total: string; paused: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'paused' OR status = 'disabled')::text AS paused
     FROM channel_shield_protections`,
  );

  return {
    byChannel: byChannel.rows.map((r) => ({
      channel: r.channel,
      total: Number(r.total),
      held: Number(r.held),
      malicious: Number(r.malicious),
      suspect: Number(r.suspect),
      clean: Number(r.clean),
      error: Number(r.error),
    })),
    quarantineDepth: Number(depth.rows[0]?.n ?? 0),
    protectionCount: Number(prots.rows[0]?.total ?? 0),
    pausedCount: Number(prots.rows[0]?.paused ?? 0),
  };
}

export async function listChannelShieldProtections(limit = 100): Promise<ShieldProtectionRow[]> {
  const result = await query<{
    id: string;
    workspace_id: string;
    channel: string;
    external_key: string;
    mode: string;
    status: string;
    updated_at: Date;
  }>(
    `SELECT id, workspace_id, channel, external_key, mode, status, updated_at
     FROM channel_shield_protections
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    channel: r.channel,
    externalKey: r.external_key,
    mode: r.mode,
    status: r.status,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

export async function setProtectionStatus(
  protectionId: string,
  status: 'active' | 'paused' | 'disabled',
): Promise<ShieldProtectionRow | null> {
  const result = await query<{
    id: string;
    workspace_id: string;
    channel: string;
    external_key: string;
    mode: string;
    status: string;
    updated_at: Date;
  }>(
    `UPDATE channel_shield_protections
     SET status = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, workspace_id, channel, external_key, mode, status, updated_at`,
    [protectionId, status],
  );
  const r = result.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    channel: r.channel,
    externalKey: r.external_key,
    mode: r.mode,
    status: r.status,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const SHIELD_CHANNELS = [
  'email',
  'slack',
  'teams',
  'telegram',
  'whatsapp',
  'discord',
  'sms',
  'web',
] as const;

export type ShieldChannelName = (typeof SHIELD_CHANNELS)[number];

export function listShieldChannelOptions(): ShieldChannelName[] {
  return [...SHIELD_CHANNELS];
}

export function defaultOpsWorkspaceId(): string {
  return (
    process.env.OPS_CHANNEL_SHIELD_WORKSPACE_ID?.trim()
    || process.env.AIVA_DEFAULT_WORKSPACE_ID?.trim()
    || 'cbfccc8e-5406-47b2-a325-edb107793043'
  );
}

export async function createShieldProtection(input: {
  workspaceId?: string;
  channel: string;
  externalKey: string;
  mode?: 'protect' | 'monitor' | 'off';
}): Promise<ShieldProtectionRow> {
  const channel = input.channel.trim().toLowerCase();
  if (!SHIELD_CHANNELS.includes(channel as ShieldChannelName)) {
    throw new Error(`Unsupported channel: ${channel}`);
  }
  const externalKey = input.externalKey.trim();
  if (!externalKey) throw new Error('external key is required');
  const workspaceId = input.workspaceId?.trim() || defaultOpsWorkspaceId();
  const mode = input.mode && ['protect', 'monitor', 'off'].includes(input.mode)
    ? input.mode
    : 'protect';

  const result = await query<{
    id: string;
    workspace_id: string;
    channel: string;
    external_key: string;
    mode: string;
    status: string;
    updated_at: Date;
  }>(
    `INSERT INTO channel_shield_protections (
       workspace_id, channel, external_key, mode, status, delivery_target_json, policy_json
     ) VALUES ($1, $2, $3, $4, 'active', '{}'::jsonb, '{}'::jsonb)
     ON CONFLICT (workspace_id, channel, external_key)
     DO UPDATE SET
       mode = EXCLUDED.mode,
       status = 'active',
       updated_at = now()
     RETURNING id, workspace_id, channel, external_key, mode, status, updated_at`,
    [workspaceId, channel, externalKey, mode],
  );
  const r = result.rows[0]!;
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    channel: r.channel,
    externalKey: r.external_key,
    mode: r.mode,
    status: r.status,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function deleteShieldProtection(protectionId: string): Promise<boolean> {
  const result = await query(`DELETE FROM channel_shield_protections WHERE id = $1`, [protectionId]);
  return (result.rowCount ?? 0) > 0;
}

export type ShieldHeldMessage = {
  id: string;
  channel: string;
  verdict: string | null;
  riskScore: number;
  quarantineStatus: string;
  safeSummaryText: string | null;
  fromLabel: string;
  subject: string;
  createdAt: string;
};

export async function listHeldShieldMessages(limit = 50): Promise<ShieldHeldMessage[]> {
  const result = await query<{
    id: string;
    channel: string;
    verdict: string | null;
    risk_score: number;
    quarantine_status: string;
    safe_summary_text: string | null;
    envelope_json: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `SELECT id, channel, verdict, risk_score, quarantine_status, safe_summary_text, envelope_json, created_at
     FROM channel_shield_messages
     WHERE quarantine_status = 'held'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => {
    const envelope = row.envelope_json && typeof row.envelope_json === 'object'
      ? row.envelope_json
      : {};
    const from = (envelope as { from?: { id?: string; display?: string } }).from;
    return {
      id: row.id,
      channel: row.channel,
      verdict: row.verdict,
      riskScore: Number(row.risk_score || 0),
      quarantineStatus: row.quarantine_status,
      safeSummaryText: row.safe_summary_text,
      fromLabel: from?.display || from?.id || 'unknown',
      subject: String((envelope as { subject?: unknown }).subject ?? ''),
      createdAt: new Date(row.created_at).toISOString(),
    };
  });
}

export async function setHeldMessageStatus(
  messageId: string,
  status: 'released' | 'destroyed',
): Promise<boolean> {
  const result = await query(
    `UPDATE channel_shield_messages
     SET quarantine_status = $2, updated_at = now(), delivered_at = CASE WHEN $2 = 'released' THEN now() ELSE delivered_at END
     WHERE id = $1 AND quarantine_status = 'held'
     RETURNING id`,
    [messageId, status],
  );
  if ((result.rowCount ?? 0) === 0) return false;
  await query(
    `INSERT INTO channel_shield_events (message_id, actor, action, detail_json)
     VALUES ($1, 'ops-console', $2, $3::jsonb)`,
    [messageId, status, JSON.stringify({ source: 'ops.carinaai.uk' })],
  ).catch(() => undefined);
  return true;
}

export async function seedDemoHeldMessage(protectionId: string): Promise<ShieldHeldMessage | null> {
  const protection = await query<{
    id: string;
    workspace_id: string;
    channel: string;
  }>(
    `SELECT id, workspace_id, channel FROM channel_shield_protections WHERE id = $1`,
    [protectionId],
  );
  const row = protection.rows[0];
  if (!row) return null;

  const externalMessageId = `ops-demo-${Date.now()}`;
  const envelope = {
    from: { id: 'demo-sender@example.com', display: 'Demo Sender' },
    subject: 'Demo quarantine item',
    text: 'This is a sample held message so you can exercise Release / Destroy in ops.',
  };
  const inserted = await query<{
    id: string;
    channel: string;
    verdict: string | null;
    risk_score: number;
    quarantine_status: string;
    safe_summary_text: string | null;
    created_at: Date;
  }>(
    `INSERT INTO channel_shield_messages (
       protection_id, workspace_id, channel, external_message_id, conversation_id,
       envelope_json, raw_storage_uri, verdict, risk_score, quarantine_status, safe_summary_text
     ) VALUES (
       $1, $2, $3, $4, 'ops-demo',
       $5::jsonb, 'ops://demo', 'suspect', 0.72, 'held',
       'Demo held message created from ops Channel Shield.'
     )
     RETURNING id, channel, verdict, risk_score, quarantine_status, safe_summary_text, created_at`,
    [row.id, row.workspace_id, row.channel, externalMessageId, JSON.stringify(envelope)],
  );
  const msg = inserted.rows[0];
  if (!msg) return null;
  return {
    id: msg.id,
    channel: msg.channel,
    verdict: msg.verdict,
    riskScore: Number(msg.risk_score || 0),
    quarantineStatus: msg.quarantine_status,
    safeSummaryText: msg.safe_summary_text,
    fromLabel: 'Demo Sender',
    subject: 'Demo quarantine item',
    createdAt: new Date(msg.created_at).toISOString(),
  };
}

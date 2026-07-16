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

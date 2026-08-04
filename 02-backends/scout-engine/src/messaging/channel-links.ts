import crypto from 'node:crypto';

type QueryResult<T> = {
  rows: T[];
  rowCount?: number;
};

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export type OperatorChannel = 'telegram' | 'whatsapp' | 'slack';
export type OperatorRole = 'owner' | 'operator';

export interface ChannelOperatorLinkRow {
  id: string;
  organization_id: string;
  dashboard_user_id: string;
  channel: OperatorChannel;
  channel_user_ref: string;
  chat_ref: string | null;
  role: OperatorRole;
  enabled: boolean;
  linked_at: string | Date;
  revoked_at: string | Date | null;
  confirmed_at: string | Date | null;
  control_scope: string;
  metadata: Record<string, unknown> | null;
}

export interface ChannelOperatorLinkPublic extends ChannelOperatorLinkRow {
  channel_user_ref_masked: string | null;
  chat_ref_masked: string | null;
}

export interface OrganizationControlSettingsRow {
  organization_id: string;
  panic_mode: boolean;
  updated_at: string | Date;
}

export interface ChannelLinkCodeRow {
  id: string;
  organization_id: string;
  dashboard_user_id: string;
  channel: OperatorChannel;
  code_hash: string;
  role: OperatorRole;
  expires_at: string | Date;
  consumed_at: string | Date | null;
  consumed_by: string | null;
  consumed_chat_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
}

export interface ChannelLinkDependencies {
  pool: Queryable;
  now: () => Date;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toIsoTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function maskRef(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 6) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function normalizeChannel(channel: string): OperatorChannel | null {
  if (channel === 'telegram' || channel === 'whatsapp' || channel === 'slack') return channel;
  return null;
}

export function generateLinkCode(channel: OperatorChannel): string {
  const prefix = channel === 'telegram' ? 'T' : channel === 'whatsapp' ? 'W' : 'S';
  return `SCOUT-${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

export function hashLinkCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

function mapLinkRow(row: ChannelOperatorLinkRow): ChannelOperatorLinkPublic {
  return {
    ...row,
    metadata: normalizeMetadata(row.metadata),
    linked_at: toIsoTimestamp(row.linked_at) ?? row.linked_at,
    revoked_at: toIsoTimestamp(row.revoked_at),
    confirmed_at: toIsoTimestamp(row.confirmed_at),
    channel_user_ref_masked: maskRef(row.channel_user_ref),
    chat_ref_masked: maskRef(row.chat_ref),
  };
}

export function createChannelLinkService(deps: ChannelLinkDependencies) {
  async function listLinks(organizationId: string): Promise<ChannelOperatorLinkPublic[]> {
    const result = await deps.pool.query<ChannelOperatorLinkRow>(
      `SELECT id, organization_id, dashboard_user_id, channel, channel_user_ref, chat_ref,
              role, enabled, linked_at, revoked_at, confirmed_at, control_scope, metadata
       FROM channel_operator_links
       WHERE organization_id = $1
       ORDER BY linked_at DESC`,
      [organizationId],
    );
    return result.rows.map((row) => mapLinkRow(row));
  }

  async function findLinkedOperator(channel: OperatorChannel, channelUserRef: string): Promise<ChannelOperatorLinkPublic | null> {
    const result = await deps.pool.query<ChannelOperatorLinkRow>(
      `SELECT id, organization_id, dashboard_user_id, channel, channel_user_ref, chat_ref,
              role, enabled, linked_at, revoked_at, confirmed_at, control_scope, metadata
       FROM channel_operator_links
       WHERE channel = $1
         AND channel_user_ref = $2
         AND enabled = TRUE
         AND revoked_at IS NULL
       ORDER BY linked_at DESC
       LIMIT 1`,
      [channel, channelUserRef],
    );
    const row = result.rows[0];
    return row ? mapLinkRow(row) : null;
  }

  async function getPanicMode(organizationId: string): Promise<boolean> {
    const result = await deps.pool.query<{ panic_mode: boolean }>(
      `SELECT panic_mode
       FROM organization_control_settings
       WHERE organization_id = $1`,
      [organizationId],
    );
    return Boolean(result.rows[0]?.panic_mode);
  }

  async function setPanicMode(organizationId: string, panicMode: boolean): Promise<OrganizationControlSettingsRow> {
    const result = await deps.pool.query<OrganizationControlSettingsRow>(
      `INSERT INTO organization_control_settings (organization_id, panic_mode, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (organization_id)
       DO UPDATE SET panic_mode = EXCLUDED.panic_mode, updated_at = NOW()
       RETURNING organization_id, panic_mode, updated_at`,
      [organizationId, panicMode],
    );
    const row = result.rows[0];
    return row
      ? { ...row, updated_at: toIsoTimestamp(row.updated_at) ?? deps.now().toISOString() }
      : { organization_id: organizationId, panic_mode: panicMode, updated_at: deps.now().toISOString() };
  }

  async function createLinkCode(input: {
    organizationId: string;
    dashboardUserId: string;
    channel: string;
    role?: OperatorRole;
    metadata?: Record<string, unknown>;
  }): Promise<
    | { ok: true; code: string; expires_at: string; channel: OperatorChannel; role: OperatorRole }
    | { ok: false; status: number; error: string; code?: string }
  > {
    const channel = normalizeChannel(input.channel);
    if (!channel) {
      return { ok: false, status: 400, error: 'channel must be telegram, whatsapp, or slack', code: 'forbidden' };
    }

    const code = generateLinkCode(channel);
    const expiresAt = new Date(deps.now().getTime() + 5 * 60 * 1000).toISOString();
    const result = await deps.pool.query<ChannelLinkCodeRow>(
      `INSERT INTO channel_link_codes (
         organization_id,
         dashboard_user_id,
         channel,
         code_hash,
         role,
         expires_at,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, organization_id, dashboard_user_id, channel, code_hash, role,
                 expires_at, consumed_at, consumed_by, consumed_chat_ref, metadata, created_at`,
      [
        input.organizationId,
        input.dashboardUserId,
        channel,
        hashLinkCode(code),
        input.role ?? 'operator',
        expiresAt,
        JSON.stringify(input.metadata ?? {}),
      ],
    );

    if (!result.rows[0]) {
      return { ok: false, status: 500, error: 'Failed to create link code' };
    }

    return {
      ok: true,
      code,
      expires_at: expiresAt,
      channel,
      role: input.role ?? 'operator',
    };
  }

  async function revokeLink(organizationId: string, linkId: string): Promise<boolean> {
    const result = await deps.pool.query(
      `UPDATE channel_operator_links
       SET enabled = FALSE,
           revoked_at = COALESCE(revoked_at, NOW())
       WHERE organization_id = $1
         AND id = $2
       RETURNING id`,
      [organizationId, linkId],
    );
    return Boolean(result.rows[0]);
  }

  async function consumeLinkCode(input: {
    code: string;
    channel: OperatorChannel;
    channelUserRef: string;
    chatRef: string | null;
    confirmedBy?: string | null;
  }): Promise<
    | { ok: true; link: ChannelOperatorLinkPublic }
    | { ok: false; status: number; error: string; code?: string }
  > {
    const codeHash = hashLinkCode(input.code);
    const lookup = await deps.pool.query<ChannelLinkCodeRow>(
      `SELECT id, organization_id, dashboard_user_id, channel, code_hash, role,
              expires_at, consumed_at, consumed_by, consumed_chat_ref, metadata, created_at
       FROM channel_link_codes
       WHERE code_hash = $1
         AND channel = $2
       LIMIT 1`,
      [codeHash, input.channel],
    );

    const codeRow = lookup.rows[0];
    if (!codeRow) {
      return { ok: false, status: 404, error: 'Link code not found', code: 'not_found' };
    }
    if (codeRow.consumed_at) {
      return { ok: false, status: 400, error: 'Link code already used', code: 'already_in_state' };
    }
    if (new Date(codeRow.expires_at).getTime() < deps.now().getTime()) {
      return { ok: false, status: 400, error: 'Link code expired', code: 'expired' };
    }

    await deps.pool.query(
      `UPDATE channel_link_codes
       SET consumed_at = NOW(),
           consumed_by = $2,
           consumed_chat_ref = $3
       WHERE id = $1`,
      [codeRow.id, input.channelUserRef, input.chatRef],
    );

    const insert = await deps.pool.query<ChannelOperatorLinkRow>(
      `INSERT INTO channel_operator_links (
         organization_id,
         dashboard_user_id,
         channel,
         channel_user_ref,
         chat_ref,
         role,
         enabled,
         linked_at,
         revoked_at,
         confirmed_at,
         control_scope,
         metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NULL, NOW(), 'org', $7)
       ON CONFLICT (organization_id, channel, channel_user_ref)
       WHERE revoked_at IS NULL
       DO UPDATE SET
         dashboard_user_id = EXCLUDED.dashboard_user_id,
         chat_ref = EXCLUDED.chat_ref,
         role = EXCLUDED.role,
         enabled = TRUE,
         revoked_at = NULL,
         linked_at = NOW(),
         confirmed_at = NOW(),
         metadata = EXCLUDED.metadata
       RETURNING id, organization_id, dashboard_user_id, channel, channel_user_ref, chat_ref,
                 role, enabled, linked_at, revoked_at, confirmed_at, control_scope, metadata`,
      [
        codeRow.organization_id,
        codeRow.dashboard_user_id,
        codeRow.channel,
        input.channelUserRef,
        input.chatRef,
        codeRow.role,
        JSON.stringify({
          ...normalizeMetadata(codeRow.metadata),
          linked_by: input.confirmedBy ?? null,
        }),
      ],
    );

    const linkRow = insert.rows[0];
    if (!linkRow) {
      return { ok: false, status: 500, error: 'Failed to create operator link' };
    }

    return { ok: true, link: mapLinkRow(linkRow) };
  }

  return {
    listLinks,
    findLinkedOperator,
    getPanicMode,
    setPanicMode,
    createLinkCode,
    revokeLink,
    consumeLinkCode,
  };
}


/**
 * Resource-scoped connector ACL for Aiva.
 * Grants are per workspace (and optional worker). Empty grants = broad (legacy).
 * When any grant exists for a connector+kind, enforcement is strict.
 * Write/action requests with indeterminate targets fail closed.
 */

import { pool } from '../memory/db.js';
import { appendSecurityAudit } from '../security/security-audit.js';

export type ConnectorActionClass = 'read' | 'write' | 'admin';

export type ConnectorName =
  | 'slack'
  | 'email'
  | 'meta'
  | 'calendar'
  | 'trello'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'drive'
  | 'notion'
  | 'crm';

export interface ResourceKindSpec {
  kind: string;
  label: string;
  /** Param / body / query field names that carry the resource id. */
  idFields: string[];
  matchMode?: 'exact' | 'prefix';
}

export interface ConnectorResourceCatalog {
  connector: ConnectorName;
  label: string;
  kinds: ResourceKindSpec[];
}

export interface ResourceRef {
  kind: string;
  id: string;
}

export interface ResourceScopeRequest {
  workspaceId: string;
  workerId?: string;
  connector: ConnectorName | string;
  action: ConnectorActionClass;
  /** Explicit refs when already known. */
  refs?: ResourceRef[];
  /** Raw tool/API params used to extract refs. */
  params?: Record<string, unknown>;
  path?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  actor?: string;
}

export interface ResourceScopeResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  kind?: string;
  target?: string;
  mode?: 'broad' | 'scoped';
}

export interface ConnectorResourceGrant {
  id: number;
  workspaceId: string;
  workerId: string | null;
  connector: string;
  resourceKind: string;
  resourceId: string;
  label: string | null;
  actions: ConnectorActionClass[];
  createdAt: string;
  revokedAt: string | null;
}

/** Catalog of connectors Aiva can scope today. */
export const CONNECTOR_RESOURCE_CATALOG: ConnectorResourceCatalog[] = [
  {
    connector: 'slack',
    label: 'Slack',
    kinds: [{ kind: 'channels', label: 'Channels', idFields: ['channelId', 'channel', 'channel_id'] }],
  },
  {
    connector: 'email',
    label: 'Email',
    kinds: [{ kind: 'mailboxes', label: 'Mailboxes', idFields: ['mailbox', 'from', 'email', 'account'] }],
  },
  {
    connector: 'meta',
    label: 'Meta (Facebook / Instagram)',
    kinds: [{ kind: 'pages', label: 'Pages', idFields: ['pageId', 'page_id', 'identifier'] }],
  },
  {
    connector: 'calendar',
    label: 'Calendar',
    kinds: [{ kind: 'calendars', label: 'Calendars', idFields: ['calendarId', 'calendar_id'] }],
  },
  {
    connector: 'trello',
    label: 'Trello',
    kinds: [
      { kind: 'boards', label: 'Boards', idFields: ['boardId', 'board_id', 'idBoard'] },
      { kind: 'lists', label: 'Lists', idFields: ['listId', 'list_id'] },
    ],
  },
  {
    connector: 'linkedin',
    label: 'LinkedIn',
    kinds: [{ kind: 'accounts', label: 'Accounts', idFields: ['accountId', 'identifier'] }],
  },
  {
    connector: 'twitter',
    label: 'X (Twitter)',
    kinds: [{ kind: 'accounts', label: 'Accounts', idFields: ['accountId', 'identifier'] }],
  },
  {
    connector: 'tiktok',
    label: 'TikTok',
    kinds: [{ kind: 'accounts', label: 'Accounts', idFields: ['accountId', 'identifier'] }],
  },
  {
    connector: 'drive',
    label: 'Google Drive',
    kinds: [{ kind: 'folders', label: 'Folders', idFields: ['folderId', 'folder_id', 'parent'], matchMode: 'prefix' }],
  },
  {
    connector: 'notion',
    label: 'Notion',
    kinds: [
      { kind: 'pages', label: 'Pages', idFields: ['pageId', 'page_id'] },
      { kind: 'databases', label: 'Databases', idFields: ['databaseId', 'database_id'] },
    ],
  },
  {
    connector: 'crm',
    label: 'CRM',
    kinds: [{ kind: 'pipelines', label: 'Pipelines', idFields: ['pipelineId', 'pipeline_id'] }],
  },
];

const TOOL_CONNECTOR_MAP: Record<string, ConnectorName> = {
  trello: 'trello',
  'trello-create-card': 'trello',
  'trello-move-card': 'trello',
  'trello-list-boards': 'trello',
  'send-message': 'slack',
  'email-send': 'email',
  'email-smtp-send': 'email',
};

let schemaReady: Promise<void> | null = null;

export async function ensureConnectorResourceSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_connector_resource_grants (
          id BIGSERIAL PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          worker_id TEXT NOT NULL DEFAULT '',
          connector TEXT NOT NULL,
          resource_kind TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          label TEXT,
          actions JSONB NOT NULL DEFAULT '["read","write"]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at TIMESTAMPTZ,
          UNIQUE (workspace_id, worker_id, connector, resource_kind, resource_id)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS aiva_connector_grants_ws_idx
          ON aiva_connector_resource_grants (workspace_id, connector)
          WHERE revoked_at IS NULL
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_connector_scope_events (
          id BIGSERIAL PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          connector TEXT NOT NULL,
          event_type TEXT NOT NULL,
          actor TEXT,
          action TEXT,
          target TEXT,
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export function getConnectorCatalog(connector?: string): ConnectorResourceCatalog | ConnectorResourceCatalog[] {
  if (!connector) return CONNECTOR_RESOURCE_CATALOG;
  const found = CONNECTOR_RESOURCE_CATALOG.find((c) => c.connector === connector.toLowerCase());
  return found ? found : [];
}

export function resolveConnectorForTool(toolName: string): ConnectorName | null {
  const key = String(toolName || '').toLowerCase();
  if (TOOL_CONNECTOR_MAP[key]) return TOOL_CONNECTOR_MAP[key];
  if (key.startsWith('trello')) return 'trello';
  if (key.startsWith('email')) return 'email';
  if (key.includes('slack')) return 'slack';
  if (key.includes('calendar')) return 'calendar';
  return null;
}

export function inferActionClass(toolName: string, params?: Record<string, unknown>): ConnectorActionClass {
  const name = String(toolName || '').toLowerCase();
  const action = String(params?.action ?? params?.method ?? '').toLowerCase();
  if (
    name.includes('list')
    || name.includes('get')
    || name.includes('read')
    || name.includes('search')
    || action === 'get'
    || action === 'list'
    || action === 'read'
  ) {
    return 'read';
  }
  if (name.includes('admin') || action === 'admin') return 'admin';
  return 'write';
}

function normalizeId(id: string, mode: 'exact' | 'prefix' = 'exact'): string {
  const raw = String(id).trim();
  if (mode === 'prefix') return raw.toLowerCase().replace(/\/+$/, '');
  return raw.toLowerCase().replace(/^#/, '');
}

function readField(obj: Record<string, unknown> | undefined, field: string): string[] {
  if (!obj) return [];
  const parts = field.split('.');
  let current: unknown[] = [obj];
  for (const part of parts) {
    const next: unknown[] = [];
    for (const item of current) {
      if (!item || typeof item !== 'object') continue;
      const v = (item as Record<string, unknown>)[part];
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) next.push(...v);
      else next.push(v);
    }
    current = next;
  }
  return current
    .filter((v) => typeof v === 'string' || typeof v === 'number')
    .map(String);
}

export function extractResourceRefs(
  connector: string,
  ctx: {
    params?: Record<string, unknown>;
    path?: string;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
  },
): { refs: ResourceRef[]; indeterminate: Set<string> } {
  const catalog = CONNECTOR_RESOURCE_CATALOG.find((c) => c.connector === connector.toLowerCase());
  const refs: ResourceRef[] = [];
  const indeterminate = new Set<string>();
  if (!catalog) return { refs, indeterminate };

  const path = String(ctx.path || '');
  for (const kind of catalog.kinds) {
    const ids: string[] = [];
    for (const field of kind.idFields) {
      ids.push(...readField(ctx.params, field));
      ids.push(...readField(ctx.body, field));
      ids.push(...readField(ctx.query, field));
    }
    // Path patterns for common REST shapes: /boards/:id, /channels/:id
    const pathRe = new RegExp(`/${kind.kind.slice(0, -1)}[s]?/([^/?#]+)`, 'i');
    const m = path.match(pathRe);
    if (m?.[1]) ids.push(decodeURIComponent(m[1]));

    const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
    if (unique.length > 0) {
      for (const id of unique) refs.push({ kind: kind.kind, id });
    } else {
      // Tool params mention this connector kind without an id → indeterminate for writes.
      const mentionsKind = kind.idFields.some((f) => {
        const base = f.split('.')[0];
        return ctx.params && Object.prototype.hasOwnProperty.call(ctx.params, base);
      });
      if (mentionsKind) indeterminate.add(kind.kind);
    }
  }
  return { refs, indeterminate };
}

async function logScopeEvent(input: {
  workspaceId: string;
  connector: string;
  eventType: string;
  actor?: string;
  action?: string;
  target?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await ensureConnectorResourceSchema();
    await pool.query(
      `INSERT INTO aiva_connector_scope_events
         (workspace_id, connector, event_type, actor, action, target, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        input.workspaceId,
        input.connector,
        input.eventType,
        input.actor ?? null,
        input.action ?? null,
        input.target ?? null,
        JSON.stringify(input.details ?? {}),
      ],
    );
  } catch (err) {
    console.warn('[connector-scopes] event log failed:', err);
  }
  appendSecurityAudit({
    category: 'connector_scope',
    action: input.eventType,
    detail: `${input.connector}:${input.target ?? ''}`,
    metadata: {
      workspaceId: input.workspaceId,
      connector: input.connector,
      actor: input.actor,
      action: input.action,
      target: input.target,
      ...(input.details ?? {}),
    },
  });
}

export async function listResourceGrants(
  workspaceId: string,
  opts?: { workerId?: string; connector?: string; includeRevoked?: boolean },
): Promise<ConnectorResourceGrant[]> {
  await ensureConnectorResourceSchema();
  const params: unknown[] = [workspaceId];
  let sql = `
    SELECT id, workspace_id, worker_id, connector, resource_kind, resource_id,
           label, actions, created_at, revoked_at
    FROM aiva_connector_resource_grants
    WHERE workspace_id = $1`;
  if (!opts?.includeRevoked) sql += ' AND revoked_at IS NULL';
  if (opts?.connector) {
    params.push(opts.connector.toLowerCase());
    sql += ` AND connector = $${params.length}`;
  }
  if (opts?.workerId) {
    params.push(opts.workerId);
    sql += ` AND (worker_id = '' OR worker_id = $${params.length})`;
  }
  sql += ' ORDER BY connector, resource_kind, created_at DESC';
  const result = await pool.query(sql, params);
  return result.rows.map((row) => ({
    id: Number(row.id),
    workspaceId: String(row.workspace_id),
    workerId: row.worker_id && String(row.worker_id) ? String(row.worker_id) : null,
    connector: String(row.connector),
    resourceKind: String(row.resource_kind),
    resourceId: String(row.resource_id),
    label: row.label ? String(row.label) : null,
    actions: Array.isArray(row.actions) ? row.actions as ConnectorActionClass[] : ['read', 'write'],
    createdAt: new Date(row.created_at).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
  }));
}

export async function grantConnectorResource(input: {
  workspaceId: string;
  workerId?: string | null;
  connector: string;
  resourceKind: string;
  resourceId: string;
  label?: string;
  actions?: ConnectorActionClass[];
  actor?: string;
}): Promise<ConnectorResourceGrant> {
  await ensureConnectorResourceSchema();
  const connector = input.connector.toLowerCase();
  const kind = input.resourceKind.toLowerCase();
  const resourceId = String(input.resourceId).trim();
  if (!resourceId) throw new Error('resourceId is required');
  const actions = input.actions?.length ? input.actions : (['read', 'write'] as ConnectorActionClass[]);
  const workerId = input.workerId ? String(input.workerId) : '';

  const result = await pool.query(
    `INSERT INTO aiva_connector_resource_grants
       (workspace_id, worker_id, connector, resource_kind, resource_id, label, actions, revoked_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NULL)
     ON CONFLICT (workspace_id, worker_id, connector, resource_kind, resource_id)
     DO UPDATE SET
       label = EXCLUDED.label,
       actions = EXCLUDED.actions,
       revoked_at = NULL,
       created_at = NOW()
     RETURNING *`,
    [
      input.workspaceId,
      workerId,
      connector,
      kind,
      resourceId,
      input.label ?? null,
      JSON.stringify(actions),
    ],
  );
  const row = result.rows[0];
  await logScopeEvent({
    workspaceId: input.workspaceId,
    connector,
    eventType: 'grant',
    actor: input.actor,
    action: actions.join(','),
    target: `${kind}:${resourceId}`,
    details: { workerId, label: input.label },
  });
  return {
    id: Number(row.id),
    workspaceId: String(row.workspace_id),
    workerId: row.worker_id && String(row.worker_id) ? String(row.worker_id) : null,
    connector: String(row.connector),
    resourceKind: String(row.resource_kind),
    resourceId: String(row.resource_id),
    label: row.label ? String(row.label) : null,
    actions,
    createdAt: new Date(row.created_at).toISOString(),
    revokedAt: null,
  };
}

export async function revokeConnectorResource(input: {
  workspaceId: string;
  grantId?: number;
  connector?: string;
  resourceKind?: string;
  resourceId?: string;
  actor?: string;
}): Promise<boolean> {
  await ensureConnectorResourceSchema();
  let result;
  if (input.grantId) {
    result = await pool.query(
      `UPDATE aiva_connector_resource_grants
       SET revoked_at = NOW()
       WHERE workspace_id = $1 AND id = $2 AND revoked_at IS NULL
       RETURNING connector, resource_kind, resource_id`,
      [input.workspaceId, input.grantId],
    );
  } else if (input.connector && input.resourceKind && input.resourceId) {
    result = await pool.query(
      `UPDATE aiva_connector_resource_grants
       SET revoked_at = NOW()
       WHERE workspace_id = $1 AND connector = $2 AND resource_kind = $3
         AND resource_id = $4 AND revoked_at IS NULL
       RETURNING connector, resource_kind, resource_id`,
      [
        input.workspaceId,
        input.connector.toLowerCase(),
        input.resourceKind.toLowerCase(),
        input.resourceId,
      ],
    );
  } else {
    throw new Error('grantId or connector+resourceKind+resourceId required');
  }
  if ((result.rowCount ?? 0) === 0) return false;
  const row = result.rows[0];
  await logScopeEvent({
    workspaceId: input.workspaceId,
    connector: String(row.connector),
    eventType: 'revoke',
    actor: input.actor,
    target: `${row.resource_kind}:${row.resource_id}`,
  });
  return true;
}

/**
 * Enforce resource scope. Broad mode (no grants for connector) allows access
 * but reports mode=broad so UI can prompt to narrow.
 */
export async function enforceConnectorResourceScope(
  req: ResourceScopeRequest,
): Promise<ResourceScopeResult> {
  const connector = String(req.connector).toLowerCase();
  const catalog = CONNECTOR_RESOURCE_CATALOG.find((c) => c.connector === connector);
  if (!catalog) return { allowed: true, mode: 'broad' };

  let grants: ConnectorResourceGrant[];
  try {
    grants = await listResourceGrants(req.workspaceId, {
      workerId: req.workerId,
      connector,
    });
  } catch (err) {
    console.error('[connector-scopes] grant read failed closed for writes:', err);
    if (req.action !== 'read') {
      return {
        allowed: false,
        code: 'CONNECTOR_SCOPE_UNAVAILABLE',
        reason: 'Could not verify connector resource grants for a write action.',
      };
    }
    return { allowed: true, mode: 'broad' };
  }

  if (grants.length === 0) {
    return { allowed: true, mode: 'broad' };
  }

  const extracted = req.refs?.length
    ? { refs: req.refs, indeterminate: new Set<string>() }
    : extractResourceRefs(connector, {
      params: req.params,
      path: req.path,
      query: req.query,
      body: req.body,
    });

  // Fail closed: write/admin with no identifiable target when scoped.
  if (
    (req.action === 'write' || req.action === 'admin')
    && extracted.refs.length === 0
  ) {
    const reason = 'Write action denied: target resource could not be determined under a scoped connector grant.';
    await logScopeEvent({
      workspaceId: req.workspaceId,
      connector,
      eventType: 'deny',
      actor: req.actor,
      action: req.action,
      target: 'indeterminate',
      details: { workerId: req.workerId, indeterminate: [...extracted.indeterminate] },
    });
    return {
      allowed: false,
      code: 'CONNECTOR_SCOPE_INDETERMINATE',
      reason,
      mode: 'scoped',
    };
  }

  for (const kind of extracted.indeterminate) {
    if (req.action !== 'read') {
      const reason = `Write action denied: ${kind} target is indeterminate under scoped grants.`;
      await logScopeEvent({
        workspaceId: req.workspaceId,
        connector,
        eventType: 'deny',
        actor: req.actor,
        action: req.action,
        target: `${kind}:indeterminate`,
      });
      return {
        allowed: false,
        code: 'CONNECTOR_SCOPE_INDETERMINATE',
        kind,
        reason,
        mode: 'scoped',
      };
    }
  }

  for (const ref of extracted.refs) {
    const kindSpec = catalog.kinds.find((k) => k.kind === ref.kind);
    const mode = kindSpec?.matchMode ?? 'exact';
    const matching = grants.filter((g) => g.resourceKind === ref.kind);
    if (matching.length === 0) {
      // Other kinds may be restricted; this kind has no grants → unrestricted for that kind.
      continue;
    }

    const actionOk = matching.some((g) => {
      const idOk = mode === 'prefix'
        ? (() => {
          const refPath = normalizeId(ref.id, 'prefix');
          const prefix = normalizeId(g.resourceId, 'prefix');
          return refPath === prefix || refPath.startsWith(`${prefix}/`);
        })()
        : normalizeId(ref.id) === normalizeId(g.resourceId);
      if (!idOk) return false;
      if (req.action === 'read') {
        return g.actions.includes('read') || g.actions.includes('write') || g.actions.includes('admin');
      }
      if (req.action === 'write') return g.actions.includes('write') || g.actions.includes('admin');
      return g.actions.includes('admin');
    });

    if (!actionOk) {
      const reason = `Access to ${ref.kind} '${ref.id}' on ${connector} is not permitted by resource grants.`;
      await logScopeEvent({
        workspaceId: req.workspaceId,
        connector,
        eventType: 'deny',
        actor: req.actor,
        action: req.action,
        target: `${ref.kind}:${ref.id}`,
        details: { workerId: req.workerId },
      });
      return {
        allowed: false,
        code: 'CONNECTOR_SCOPE_DENIED',
        kind: ref.kind,
        target: ref.id,
        reason,
        mode: 'scoped',
      };
    }
  }

  return { allowed: true, mode: 'scoped' };
}

export async function assertToolConnectorScope(input: {
  toolName: string;
  workspaceId: string;
  workerId?: string;
  params: Record<string, unknown>;
  actor?: string;
}): Promise<ResourceScopeResult> {
  const connector = resolveConnectorForTool(input.toolName);
  if (!connector) return { allowed: true, mode: 'broad' };
  const action = inferActionClass(input.toolName, input.params);
  return enforceConnectorResourceScope({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    connector,
    action,
    params: input.params,
    actor: input.actor,
  });
}

export function describeScopedConnectorsForPrompt(
  grants: ConnectorResourceGrant[],
): string {
  if (grants.length === 0) {
    return 'Connector access is currently broad (full account). Prefer asking the user to narrow scopes when possible.';
  }
  const byConnector = new Map<string, ConnectorResourceGrant[]>();
  for (const g of grants) {
    const list = byConnector.get(g.connector) ?? [];
    list.push(g);
    byConnector.set(g.connector, list);
  }
  const lines = ['Connector access is intentionally scoped:'];
  for (const [connector, list] of byConnector) {
    const parts = list.map((g) => `${g.resourceKind}:${g.label || g.resourceId} [${g.actions.join('|')}]`);
    lines.push(`- ${connector}: ${parts.join(', ')}`);
  }
  lines.push('Do not attempt resources outside these grants.');
  return lines.join('\n');
}

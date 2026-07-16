import { pool } from '../../memory/db.js';
import { encryptCredentials, decryptCredentials } from '../../channels/credential-store.js';
import { getCatalogTool } from './catalog.js';
import { loadDepthFeatures } from './features.js';
import { upsertToolGrant } from '../spinnable-parity-store.js';

export type ToolAccountRecord = {
  id: string;
  toolSlug: string;
  label: string;
  provider: string;
  status: string;
  meta: Record<string, unknown>;
  lastProbeOk: boolean | null;
  createdAt: string;
  updatedAt: string;
};

async function ensureAccountsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiva_tool_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL,
      org_id UUID,
      tool_slug TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      credentials_enc TEXT NOT NULL,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending_probe',
      last_probe_at TIMESTAMPTZ,
      last_probe_ok BOOLEAN,
      last_probe_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS aiva_worker_tool_account_grants (
      workspace_id UUID NOT NULL,
      worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
      account_id UUID NOT NULL REFERENCES aiva_tool_accounts(id) ON DELETE CASCADE,
      tool_slug TEXT NOT NULL,
      scopes TEXT[] NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'connected',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (worker_id, account_id)
    );
    ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS org_id UUID;
  `);
}

function mapAccount(row: Record<string, unknown>): ToolAccountRecord {
  return {
    id: String(row.id),
    toolSlug: String(row.tool_slug),
    label: String(row.label ?? ''),
    provider: String(row.provider ?? ''),
    status: String(row.status),
    meta: (row.meta && typeof row.meta === 'object') ? row.meta as Record<string, unknown> : {},
    lastProbeOk: row.last_probe_ok == null ? null : Boolean(row.last_probe_ok),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export function accountsFeatureEnabled(): boolean {
  return loadDepthFeatures().tools?.accountsEnabled === true;
}

export async function listToolAccounts(workspaceId: string, toolSlug?: string, orgId?: string | null) {
  await ensureAccountsSchema();
  if (toolSlug && orgId) {
    const result = await pool.query(
      `SELECT id, tool_slug, label, provider, status, meta, last_probe_ok, created_at, updated_at
       FROM aiva_tool_accounts
       WHERE workspace_id = $1 AND tool_slug = $2 AND (org_id IS NULL OR org_id = $3::uuid)
       ORDER BY updated_at DESC`,
      [workspaceId, toolSlug, orgId],
    );
    return result.rows.map(mapAccount);
  }
  if (toolSlug) {
    const result = await pool.query(
      `SELECT id, tool_slug, label, provider, status, meta, last_probe_ok, created_at, updated_at
       FROM aiva_tool_accounts WHERE workspace_id = $1 AND tool_slug = $2
       ORDER BY updated_at DESC`,
      [workspaceId, toolSlug],
    );
    return result.rows.map(mapAccount);
  }
  if (orgId) {
    const result = await pool.query(
      `SELECT id, tool_slug, label, provider, status, meta, last_probe_ok, created_at, updated_at
       FROM aiva_tool_accounts
       WHERE workspace_id = $1 AND (org_id IS NULL OR org_id = $2::uuid)
       ORDER BY tool_slug, updated_at DESC`,
      [workspaceId, orgId],
    );
    return result.rows.map(mapAccount);
  }
  const result = await pool.query(
    `SELECT id, tool_slug, label, provider, status, meta, last_probe_ok, created_at, updated_at
     FROM aiva_tool_accounts WHERE workspace_id = $1
     ORDER BY tool_slug, updated_at DESC`,
    [workspaceId],
  );
  return result.rows.map(mapAccount);
}

export async function createAndProbeToolAccount(input: {
  workspaceId: string;
  toolSlug: string;
  label?: string;
  credentials: Record<string, string>;
  meta?: Record<string, unknown>;
  orgId?: string | null;
}): Promise<{ ok: boolean; account?: ToolAccountRecord; error?: string; probe?: unknown }> {
  await ensureAccountsSchema();
  if (!accountsFeatureEnabled()) throw new Error('Tool accounts disabled in depth-features config');
  const tool = getCatalogTool(input.toolSlug);
  if (!tool) throw new Error('Unknown tool slug');
  if (tool.status === 'coming_soon') throw new Error('Tool is coming_soon');

  const label = (input.label ?? tool.label).trim() || tool.label;
  const insert = await pool.query(
    `INSERT INTO aiva_tool_accounts
      (workspace_id, org_id, tool_slug, label, provider, credentials_enc, meta, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending_probe', NOW())
     RETURNING *`,
    [
      input.workspaceId,
      input.orgId ?? null,
      input.toolSlug,
      label,
      tool.oauthProvider ?? tool.auth,
      encryptCredentials(input.credentials),
      JSON.stringify(input.meta ?? {}),
    ],
  );
  const accountId = String(insert.rows[0].id);

  // Temporary worker-less probe via invoke with isProbe and injected session is hard;
  // run HTTP/google probe by temporarily storing credentials on a synthetic path via invoke helpers.
  const probeAction = tool.probe?.action ?? tool.actions?.[0]?.id ?? 'list';
  const probed = await probeAccountCredentials({
    workspaceId: input.workspaceId,
    accountId,
    toolSlug: input.toolSlug,
    action: probeAction,
    credentials: input.credentials,
    meta: input.meta,
  });

  await pool.query(
    `UPDATE aiva_tool_accounts SET
       status = $2, last_probe_at = NOW(), last_probe_ok = $3, last_probe_error = $4, updated_at = NOW()
     WHERE id = $1`,
    [accountId, probed.ok ? 'connected' : 'needs_reauth', probed.ok, probed.ok ? null : (probed.error ?? 'probe_failed')],
  );

  const accounts = await listToolAccounts(input.workspaceId, input.toolSlug);
  const account = accounts.find((row) => row.id === accountId);
  return { ok: probed.ok, account, error: probed.error, probe: probed.data };
}

async function probeAccountCredentials(input: {
  workspaceId: string;
  accountId: string;
  toolSlug: string;
  action: string;
  credentials: Record<string, string>;
  meta?: Record<string, unknown>;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  // Use a throwaway worker grant path: upsert session on a reserved meta worker is messy.
  // Probe through invoke with credentials passed as input for vault/http and google session upsert.
  const { upsertToolSession } = await import('./sessions.js');
  const probeWorkerId = String(input.meta?.probeWorkerId ?? '');
  if (probeWorkerId) {
    await upsertToolSession({
      workspaceId: input.workspaceId,
      workerId: probeWorkerId,
      toolSlug: input.toolSlug,
      provider: getCatalogTool(input.toolSlug)?.oauthProvider ?? 'account',
      credentials: input.credentials,
      meta: { ...(input.meta ?? {}), accountId: input.accountId },
    });
    const { invokeProductTool } = await import('./invoke.js');
    return invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: probeWorkerId,
      slug: input.toolSlug,
      action: input.action,
      input: input.meta,
      isProbe: true,
    });
  }

  // Account-only probe: HTTP/Slack/Google with direct credential vars
  const tool = getCatalogTool(input.toolSlug);
  if (!tool) return { ok: false, error: 'Unknown tool' };
  if (tool.driver === 'http' || tool.driver === 'slack') {
    const { runHttpProbeOrAction, buildBasicAuth, buildBasicUserPass } = await import('./http-driver.js');
    const vars: Record<string, string> = { ...input.credentials };
    if (vars.value && !vars.token) vars.token = vars.value;
    if (vars.email && vars.token) {
      vars.basic = buildBasicAuth(vars.email, vars.token).slice('Basic '.length);
    }
    if (vars.user && vars.password) {
      vars.basic = buildBasicUserPass(vars.user, vars.password).slice('Basic '.length);
    }
    if (tool.driver === 'slack') {
      const token = vars.token;
      if (!token) return { ok: false, error: 'token required' };
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(12000),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      return { ok: Boolean(data.ok), data, error: data.ok ? undefined : (data.error ?? 'slack_error') };
    }
    const probe = tool.probe ?? tool.actions?.[0];
    if (!probe || !('url' in probe) || !probe.url) return { ok: false, error: 'No probe URL' };
    const result = await runHttpProbeOrAction({ tool, probeOrAction: probe, vars });
    return { ok: result.ok, data: result.json ?? result.body, error: result.ok ? undefined : result.body };
  }
  if (tool.driver === 'google') {
    // Without a worker OAuth session, account store still holds refresh token for later grant
    const hasRefresh = Boolean(input.credentials.refresh_token || input.credentials.access_token);
    return {
      ok: hasRefresh,
      data: { stored: true },
      error: hasRefresh ? undefined : 'Google account requires refresh_token or access_token',
    };
  }
  if (tool.driver === 'browser') {
    return { ok: true, data: { browser: true } };
  }
  return { ok: false, error: `No account probe for driver ${tool.driver}` };
}

export async function deleteToolAccount(workspaceId: string, accountId: string) {
  await ensureAccountsSchema();
  await pool.query(
    `DELETE FROM aiva_tool_accounts WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, accountId],
  );
}

export async function probeToolAccount(workspaceId: string, accountId: string) {
  await ensureAccountsSchema();
  if (!accountsFeatureEnabled()) throw new Error('Tool accounts disabled in depth-features config');
  const accountRes = await pool.query(
    `SELECT * FROM aiva_tool_accounts WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, accountId],
  );
  if (accountRes.rows.length === 0) throw new Error('Account not found');
  const account = accountRes.rows[0];
  const tool = getCatalogTool(String(account.tool_slug));
  if (!tool) throw new Error('Unknown tool slug');
  const credentials = decryptCredentials(String(account.credentials_enc));
  const meta = (account.meta && typeof account.meta === 'object')
    ? account.meta as Record<string, unknown>
    : {};
  const probed = await probeAccountCredentials({
    workspaceId,
    accountId,
    toolSlug: String(account.tool_slug),
    action: tool.probe?.action ?? tool.actions?.[0]?.id ?? 'list',
    credentials,
    meta,
  });
  await pool.query(
    `UPDATE aiva_tool_accounts SET
       status = $2, last_probe_at = NOW(), last_probe_ok = $3, last_probe_error = $4, updated_at = NOW()
     WHERE id = $1`,
    [accountId, probed.ok ? 'connected' : 'needs_reauth', probed.ok, probed.ok ? null : (probed.error ?? 'probe_failed')],
  );
  const accounts = await listToolAccounts(workspaceId, String(account.tool_slug));
  return {
    ok: probed.ok,
    account: accounts.find((row) => row.id === accountId),
    error: probed.error,
    probe: probed.data,
  };
}

export async function grantToolAccountToWorker(input: {
  workspaceId: string;
  workerId: string;
  accountId: string;
  scopes?: string[];
}) {
  await ensureAccountsSchema();
  if (!accountsFeatureEnabled()) throw new Error('Tool accounts disabled in depth-features config');
  const accountRes = await pool.query(
    `SELECT * FROM aiva_tool_accounts WHERE workspace_id = $1 AND id = $2`,
    [input.workspaceId, input.accountId],
  );
  if (accountRes.rows.length === 0) throw new Error('Account not found');
  const account = accountRes.rows[0];
  if (String(account.status) !== 'connected') {
    throw new Error('Account is not connected; reconnect and probe first');
  }
  const tool = getCatalogTool(String(account.tool_slug));
  const scopes = input.scopes?.length ? input.scopes : (tool?.scopes ?? []);

  await pool.query(
    `INSERT INTO aiva_worker_tool_account_grants
      (workspace_id, worker_id, account_id, tool_slug, scopes, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'connected', NOW())
     ON CONFLICT (worker_id, account_id) DO UPDATE SET
       scopes = EXCLUDED.scopes, status = 'connected', updated_at = NOW()`,
    [input.workspaceId, input.workerId, input.accountId, String(account.tool_slug), scopes],
  );

  // Mirror legacy grant row so workerHasToolGrant still works
  await upsertToolGrant({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    toolSlug: String(account.tool_slug),
    scopes,
    status: 'connected',
  });

  // Copy credentials into per-worker session so existing google/http drivers work
  const credentials = decryptCredentials(String(account.credentials_enc));
  const { upsertToolSession } = await import('./sessions.js');
  await upsertToolSession({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    toolSlug: String(account.tool_slug),
    provider: String(account.provider ?? ''),
    credentials,
    meta: {
      ...((account.meta && typeof account.meta === 'object') ? account.meta as Record<string, unknown> : {}),
      accountId: input.accountId,
    },
  });

  return listWorkerAccountGrants(input.workspaceId, input.workerId);
}

export async function revokeToolAccountFromWorker(
  workspaceId: string,
  workerId: string,
  accountId: string,
) {
  await ensureAccountsSchema();
  await pool.query(
    `DELETE FROM aiva_worker_tool_account_grants
     WHERE workspace_id = $1 AND worker_id = $2 AND account_id = $3`,
    [workspaceId, workerId, accountId],
  );
}

export async function listWorkerAccountGrants(workspaceId: string, workerId: string) {
  await ensureAccountsSchema();
  const result = await pool.query(
    `SELECT g.account_id, g.tool_slug, g.scopes, g.status, g.updated_at, a.label
     FROM aiva_worker_tool_account_grants g
     JOIN aiva_tool_accounts a ON a.id = g.account_id
     WHERE g.workspace_id = $1 AND g.worker_id = $2
     ORDER BY g.updated_at DESC`,
    [workspaceId, workerId],
  );
  return result.rows.map((row) => ({
    accountId: String(row.account_id),
    toolSlug: String(row.tool_slug),
    label: String(row.label ?? ''),
    scopes: Array.isArray(row.scopes)
      ? (row.scopes as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    status: String(row.status),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }));
}

export async function getAccountCredentialsForWorker(
  workspaceId: string,
  workerId: string,
  toolSlug: string,
): Promise<Record<string, string> | null> {
  if (!accountsFeatureEnabled()) return null;
  await ensureAccountsSchema();
  const result = await pool.query(
    `SELECT a.credentials_enc
     FROM aiva_worker_tool_account_grants g
     JOIN aiva_tool_accounts a ON a.id = g.account_id
     WHERE g.workspace_id = $1 AND g.worker_id = $2 AND g.tool_slug = $3
       AND g.status = 'connected' AND a.status = 'connected'
     ORDER BY g.updated_at DESC
     LIMIT 1`,
    [workspaceId, workerId, toolSlug],
  );
  if (result.rows.length === 0) return null;
  return decryptCredentials(String(result.rows[0].credentials_enc));
}

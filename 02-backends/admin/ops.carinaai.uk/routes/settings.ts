import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { Router } from 'express';
import { SCOUT_BASE, SCOUT_CONSOLE_BASE, scoutGet, scoutConsoleGetDetailed, scoutConsolePut, scoutConsolePost } from '../lib/scout.js';
import { CARINA_BASE, carinaGet, carinaJson, carinaOpsTokenSet, carinaPut } from '../lib/carina.js';
import { autoPairCarinaFromLocalCore, testCarinaConnection } from '../lib/carina-pairing.js';
import { coreEnvReadable, coreEnvSourceLabel } from '../lib/core-env.js';
import { OPS_ENV_PATH, setEnvVar } from '../lib/env.js';
import {
  applyGlobalEmailIngestionEnabled,
  getGlobalEmailIngestionStatus,
} from '../lib/email-ingestion-global.js';
import {
  channelShieldTablesReady,
  createShieldProtection,
  defaultOpsWorkspaceId,
  deleteShieldProtection,
  fetchChannelShieldMetrics,
  listChannelShieldProtections,
  listHeldShieldMessages,
  listShieldChannelOptions,
  seedDemoHeldMessage,
  setHeldMessageStatus,
  setProtectionStatus,
} from '../lib/channel-shield-ops.js';
import { shieldAdaptersHealthViaCore } from '../lib/channel-shield-health.js';

export const settingsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireScoutApiKey(res: import('express').Response): boolean {
  if (!process.env.SCOUT_API_KEY) {
    res.status(400).json({ ok: false, error: 'SCOUT_API_KEY not set. Pair with Scout first.' });
    return false;
  }
  return true;
}

function parseAccountId(value: unknown): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  return UUID_RE.test(id) ? id : null;
}

function connectorAccountQuery(accountId: string): string {
  return `?account_id=${encodeURIComponent(accountId)}`;
}

const SCOUT_HTPASSWD =
  process.env.SCOUT_HTPASSWD_FILE ?? '/etc/carina/scout/.htpasswd';
const SCOUT_HTPASSWD_USER = process.env.SCOUT_HTPASSWD_USER ?? 'admin';

type FlashMessage = { type: 'success' | 'error' | 'warning'; text: string; key: string };

type LlmRotationStatus = {
  enabled?: boolean;
  providers?: string[];
  defaultProvider?: string;
  model?: string;
  configuredProviders?: string[];
  chain?: string[];
  knownProviders?: Array<{
    name: string;
    displayName: string;
    configured: boolean;
    model: string;
    models?: string[];
    local: boolean;
    inAllowlist: boolean;
  }>;
  modelsByProvider?: Record<string, string[]>;
  source?: string;
  note?: string;
  error?: string;
};

function buildFlashMessages(
  query: Record<string, unknown>,
  options: { suppressGlobalEmailIngestionError?: boolean } = {},
): FlashMessage[] {
  const messages: FlashMessage[] = [];
  const add = (okKey: string, errKey: string, okText: string) => {
    if (query[okKey] === '1') messages.push({ type: 'success', text: okText, key: okKey });
    const err = query[errKey];
    if (
      typeof err === 'string'
      && err.trim()
      && !(options.suppressGlobalEmailIngestionError && errKey === 'email_ingestion_global_err')
    ) {
      messages.push({ type: 'error', text: err, key: errKey });
    }
  };

  add('scout_ok', 'scout_err', 'Scout console password updated.');
  add('scout_pair_ok', 'scout_pair_err', 'Scout API key saved.');
  add('carina_auto_pair_ok', 'carina_auto_pair_err', 'Carina agent connected automatically.');
  add('carina_pair_ok', 'carina_pair_err', 'Carina ops token saved.');
  add('carina_android_apk_ok', 'carina_android_apk_err', 'Android APK link saved.');
  add('core_web_password_ok', 'core_web_password_err', 'Core web login password updated.');
  add('ops_admin_password_ok', 'ops_admin_password_err', 'Ops admin password updated.');
  add('email_ingestion_global_ok', 'email_ingestion_global_err', 'Global email ingestion updated.');
  add('email_ingestion_ok', 'email_ingestion_err', 'Email ingestion gate updated.');
  add('shield_ok', 'shield_err', 'Channel Shield protection updated.');
  add('scout_control_ok', 'scout_control_err', 'Scout control settings updated.');
  return messages;
}

settingsRouter.get('/', async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  let coreWebPasswordSet = false;
  let carinaConnected = false;
  let scoutConnected = false;
  const globalEmailIngestion = getGlobalEmailIngestionStatus();
  let emailIngestionEnabled = false;
  let emailIngestionWorkspaceId = defaultOpsWorkspaceId();
  let llmStatus: LlmRotationStatus = {
    enabled: false,
    providers: [],
    defaultProvider: '',
    model: '',
    configuredProviders: [],
    chain: [],
    knownProviders: [],
    modelsByProvider: {},
    source: 'none',
    note: '',
  };
  let scoutControl = {
    mode: 'monitor',
    enforcementEnabled: false,
    alertMinimumSeverity: 'critical',
    updatedAt: null as string | null,
  };
  if (carinaOpsTokenSet()) {
    carinaConnected = await testCarinaConnection();
    if (carinaConnected) {
      const response = await carinaGet('/api/ops/web-password');
      const parsed = await carinaJson<{ set?: boolean }>(response);
      coreWebPasswordSet = parsed.ok && parsed.data?.set === true;
      const scoutControlResponse = await carinaGet('/api/ops/scout-control');
      const scoutControlParsed = await carinaJson<typeof scoutControl>(scoutControlResponse);
      if (scoutControlParsed.ok && scoutControlParsed.data) {
        scoutControl = scoutControlParsed.data;
      }
      const emailGateResponse = await carinaGet(`/api/ops/tenant-config/${encodeURIComponent(emailIngestionWorkspaceId)}`);
      const emailGateParsed = await carinaJson<{ emailIngestionEnabled?: boolean }>(emailGateResponse);
      if (emailGateParsed.ok && emailGateParsed.data) {
        emailIngestionEnabled = Boolean(emailGateParsed.data.emailIngestionEnabled);
      }
      const llmRotationResponse = await carinaGet('/api/ops/llm-rotation');
      const llmRotationParsed = await carinaJson<LlmRotationStatus>(llmRotationResponse);
      if (llmRotationParsed.ok && llmRotationParsed.data) {
        llmStatus = llmRotationParsed.data;
      }
    }
  }
  if (process.env.SCOUT_API_KEY) {
    scoutConnected = (await scoutGet('/api/admin/status')) !== null;
  }
  res.render('settings', {
    title: 'Settings',
    carinaApiUrl: CARINA_BASE,
    carinaAndroidApkUrl: process.env.CARINA_ANDROID_APK_URL ?? '',
    scoutUrl: SCOUT_BASE,
    scoutConsoleUrl: SCOUT_CONSOLE_BASE,
    adminPasswordSet: adminPassword !== 'changeme',
    coreWebPasswordSet,
    skillAutoWrite: process.env.SKILL_AUTO_WRITE === 'true',
    port: process.env.PORT ?? '4000',
    scoutOk: req.query['scout_ok'] === '1',
    scoutErr: typeof req.query['scout_err'] === 'string' ? req.query['scout_err'] : '',
    scoutPaired: Boolean(process.env.SCOUT_API_KEY),
    scoutConnected,
    scoutControl,
    globalEmailIngestion,
    emailIngestionEnabled,
    emailIngestionWorkspaceId,
    llmStatus,
    scoutPairOk: req.query['scout_pair_ok'] === '1',
    scoutPairErr: typeof req.query['scout_pair_err'] === 'string' ? req.query['scout_pair_err'] : '',
    carinaPaired: carinaOpsTokenSet(),
    carinaConnected,
    coreEnvReadable: coreEnvReadable(),
    coreEnvPath: coreEnvSourceLabel(),
    carinaAutoPairOk: req.query['carina_auto_pair_ok'] === '1',
    carinaAutoPairErr: typeof req.query['carina_auto_pair_err'] === 'string'
      ? req.query['carina_auto_pair_err']
      : '',
    carinaPairOk: req.query['carina_pair_ok'] === '1',
    carinaPairErr: typeof req.query['carina_pair_err'] === 'string' ? req.query['carina_pair_err'] : '',
    carinaAndroidApkOk: req.query['carina_android_apk_ok'] === '1',
    carinaAndroidApkErr: typeof req.query['carina_android_apk_err'] === 'string'
      ? req.query['carina_android_apk_err']
      : '',
    coreWebPasswordOk: req.query['core_web_password_ok'] === '1',
    coreWebPasswordErr: typeof req.query['core_web_password_err'] === 'string'
      ? req.query['core_web_password_err']
      : '',
    opsAdminPasswordOk: req.query['ops_admin_password_ok'] === '1',
    opsAdminPasswordErr: typeof req.query['ops_admin_password_err'] === 'string'
      ? req.query['ops_admin_password_err']
      : '',
    flashMessages: buildFlashMessages(req.query as Record<string, unknown>, {
      suppressGlobalEmailIngestionError: globalEmailIngestion.enabled,
    }),
  });
});

settingsRouter.post('/scout-control', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect('/settings?scout_control_err=' + encodeURIComponent('Carina ops token is not set'));
    return;
  }
  const mode = String((req.body as { mode?: unknown }).mode ?? '').trim();
  const alertMinimumSeverity = String(
    (req.body as { alertMinimumSeverity?: unknown }).alertMinimumSeverity ?? 'critical',
  ).trim();
  try {
    const response = await carinaPut('/api/ops/scout-control', { mode, alertMinimumSeverity });
    const parsed = await carinaJson<{ error?: string }>(response);
    if (!response.ok || !parsed.ok) {
      res.redirect('/settings?scout_control_err=' + encodeURIComponent(parsed.error ?? 'Save failed'));
      return;
    }
    res.redirect('/settings?scout_control_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings?scout_control_err=' + encodeURIComponent('Failed: ' + msg));
  }
});

settingsRouter.post('/email-ingestion-global', async (req, res) => {
  const enabled = String(req.body?.enabled ?? '') === '1';

  try {
    const result = await applyGlobalEmailIngestionEnabled({ enabled });
    if (!result.ok) {
      res.redirect('/settings?email_ingestion_global_err=' + encodeURIComponent(result.error ?? 'Save failed'));
      return;
    }
    res.redirect('/settings?email_ingestion_global_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings?email_ingestion_global_err=' + encodeURIComponent('Failed: ' + msg));
  }
});

settingsRouter.post('/email-ingestion', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect('/settings?email_ingestion_err=' + encodeURIComponent('Carina ops token is not set'));
    return;
  }

  const workspaceId = String(req.body?.workspaceId ?? '').trim() || defaultOpsWorkspaceId();
  const enabled = String(req.body?.enabled ?? '') === '1';

  try {
    const response = await carinaPut(`/api/ops/tenant-config/${encodeURIComponent(workspaceId)}`, {
      emailIngestionEnabled: enabled,
      actor: 'ops-admin',
    });
    const parsed = await carinaJson<{ error?: string }>(response);
    if (!response.ok || !parsed.ok) {
      res.redirect('/settings?email_ingestion_err=' + encodeURIComponent(parsed.error ?? 'Save failed'));
      return;
    }
    res.redirect('/settings?email_ingestion_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings?email_ingestion_err=' + encodeURIComponent('Failed: ' + msg));
  }
});

settingsRouter.post('/test-carina', async (_req, res) => {
  if (!carinaOpsTokenSet()) {
    res.json({
      ok: false,
      error: 'CARINA_OPS_TOKEN not set (paste the ops token from core.carinaai.uk .env)',
    });
    return;
  }
  try {
    const r = await carinaGet('/api/ops/health');
    const body = await r.text();
    if (!r.ok) {
      let detail = body.slice(0, 120);
      try {
        const parsed = JSON.parse(body) as { error?: string };
        if (parsed.error) detail = parsed.error;
      } catch {
        // keep raw snippet
      }
      const hint = r.status === 401
        ? ' (check CARINA_OPS_TOKEN matches core.carinaai.uk/.env; URL must be https://core.carinaai.uk)'
        : '';
      res.json({ ok: false, error: `HTTP ${r.status}${hint}: ${detail}` });
      return;
    }
    const data = JSON.parse(body) as { ok?: boolean; service?: string };
    res.json({
      ok: true,
      service: data.service ?? 'carina-gateway',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ ok: false, error: msg });
  }
});

settingsRouter.post('/test-scout', async (_req, res) => {
  const data = (await scoutGet('/api/admin/status')) as { instances?: unknown[] } | null;
  if (!data) {
    res.json({ ok: false });
    return;
  }
  res.json({ ok: true, instances: data.instances ?? [] });
});

settingsRouter.post('/scout-password', async (req, res) => {
  const { newPassword, confirmPassword } = req.body as {
    newPassword?: string;
    confirmPassword?: string;
  };

  if (!newPassword || newPassword.length < 8) {
    res.redirect('/settings?scout_err=' + encodeURIComponent('Password must be at least 8 characters'));
    return;
  }
  if (newPassword !== confirmPassword) {
    res.redirect('/settings?scout_err=' + encodeURIComponent('Passwords do not match'));
    return;
  }

  try {
    const hash = execFileSync('/usr/bin/openssl', ['passwd', '-apr1', newPassword], { encoding: 'utf8' }).trim();
    writeFileSync(SCOUT_HTPASSWD, `${SCOUT_HTPASSWD_USER}:${hash}\n`, { encoding: 'utf8', mode: 0o644 });
    res.redirect('/settings?scout_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings?scout_err=' + encodeURIComponent('Failed: ' + msg));
  }
});

settingsRouter.post('/carina-auto-pair', async (_req, res) => {
  const result = await autoPairCarinaFromLocalCore();
  if (!result.ok) {
    res.redirect('/settings?carina_auto_pair_err=' + encodeURIComponent(result.error ?? 'Auto-connect failed'));
    return;
  }
  if (result.alreadyPaired) {
    res.redirect('/settings?carina_auto_pair_ok=1');
    return;
  }
  res.redirect('/settings?carina_auto_pair_ok=1');
});

settingsRouter.post('/carina-pairing', (req, res) => {
  const { carinaOpsToken } = req.body as { carinaOpsToken?: string };
  const token = (carinaOpsToken ?? '').trim();

  if (!token) {
    res.redirect('/settings?carina_pair_err=' + encodeURIComponent('Paste your Carina ops token'));
    return;
  }

  try {
    setEnvVar(OPS_ENV_PATH, 'CARINA_OPS_TOKEN', token);
    res.redirect('/settings?carina_pair_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings?carina_pair_err=' + encodeURIComponent('Failed: ' + msg));
  }
});

settingsRouter.post('/carina-android-apk', (req, res) => {
  const apkUrl = String(req.body?.apkUrl ?? '').trim();

  if (!apkUrl) {
    res.redirect('/settings?carina_android_apk_err=' + encodeURIComponent('Paste the APK download URL'));
    return;
  }

  try {
    setEnvVar(OPS_ENV_PATH, 'CARINA_ANDROID_APK_URL', apkUrl);
    res.redirect('/settings?carina_android_apk_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings?carina_android_apk_err=' + encodeURIComponent('Failed: ' + msg));
  }
});

settingsRouter.post('/carina-web-password', async (req, res) => {
  if (!carinaOpsTokenSet()) {
    res.redirect('/settings?core_web_password_err=' + encodeURIComponent('Pair Carina in Settings first (CARINA_OPS_TOKEN).'));
    return;
  }
  const newPassword = String(req.body?.newPassword ?? '');
  const confirmPassword = String(req.body?.confirmPassword ?? '');
  const response = await carinaPut('/api/ops/web-password', {
    password: newPassword,
    confirmPassword,
    actor: 'ops-admin',
  });
  const parsed = await carinaJson<{ error?: string }>(response);
  if (!parsed.ok) {
    res.redirect('/settings?core_web_password_err=' + encodeURIComponent(parsed.error ?? 'Password update failed'));
    return;
  }
  res.redirect('/settings?core_web_password_ok=1');
});

settingsRouter.post('/ops-admin-password', (req, res) => {
  const newPassword = String(req.body?.newPassword ?? '');
  const confirmPassword = String(req.body?.confirmPassword ?? '');
  if (newPassword.length < 8) {
    res.redirect('/settings?ops_admin_password_err=' + encodeURIComponent('Password must be at least 8 characters'));
    return;
  }
  if (newPassword !== confirmPassword) {
    res.redirect('/settings?ops_admin_password_err=' + encodeURIComponent('Passwords do not match'));
    return;
  }
  try {
    setEnvVar(OPS_ENV_PATH, 'ADMIN_PASSWORD', newPassword);
    res.redirect('/settings?ops_admin_password_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings?ops_admin_password_err=' + encodeURIComponent('Failed: ' + msg));
  }
});

settingsRouter.get('/alert-channels', async (_req, res) => {
  if (!process.env.SCOUT_API_KEY) {
    res.status(400).json({ ok: false, error: 'SCOUT_API_KEY not set. Pair with Scout first.' });
    return;
  }
  const result = await scoutConsoleGetDetailed('/api/admin/alert-channels');
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Scout unreachable' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.put('/alert-channels/:type', async (req, res) => {
  const type = String(req.params.type ?? '');
  if (!['telegram', 'email', 'slack', 'whatsapp'].includes(type)) {
    res.status(400).json({ ok: false, error: 'Invalid channel type' });
    return;
  }
  if (!process.env.SCOUT_API_KEY) {
    res.status(400).json({ ok: false, error: 'SCOUT_API_KEY not set' });
    return;
  }
  const result = await scoutConsolePut(`/api/admin/alert-channels/${type}`, req.body ?? {});
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Save failed' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.put('/alert-channels-platform', async (req, res) => {
  if (!process.env.SCOUT_API_KEY) {
    res.status(400).json({ ok: false, error: 'SCOUT_API_KEY not set' });
    return;
  }
  const result = await scoutConsolePut('/api/admin/alert-channels/platform', req.body ?? {});
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Save failed' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.post('/alert-test', async (req, res) => {
  if (!process.env.SCOUT_API_KEY) {
    res.json({ ok: false, error: 'SCOUT_API_KEY not set' });
    return;
  }
  const severity = typeof req.body?.severity === 'string' ? req.body.severity : 'critical';
  const result = await scoutConsolePost('/api/admin/alert-test', { severity });
  if (!result.ok) {
    res.json({ ok: false, error: result.error ?? 'Alert test failed or Scout unreachable' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.get('/connectors/accounts', async (_req, res) => {
  if (!requireScoutApiKey(res)) return;
  const result = await scoutConsoleGetDetailed('/api/admin/accounts');
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Scout unreachable' });
    return;
  }
  const accounts =
    result.data && typeof result.data === 'object' && 'accounts' in result.data
      ? (result.data as { accounts: Array<Record<string, unknown>> }).accounts
      : [];
  res.json({ ok: true, accounts });
});

settingsRouter.get('/connectors', async (req, res) => {
  if (!requireScoutApiKey(res)) return;
  const accountId = parseAccountId(req.query.account_id);
  const path = accountId
    ? `/api/admin/connectors${connectorAccountQuery(accountId)}`
    : '/api/admin/connectors';
  const result = await scoutConsoleGetDetailed(path);
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Scout unreachable' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.post('/connectors/:id/enable', async (req, res) => {
  if (!requireScoutApiKey(res)) return;
  const connectorId = String(req.params.id ?? '').trim();
  const accountId = parseAccountId(req.body?.account_id);
  if (!accountId) {
    res.status(400).json({ ok: false, error: 'account_id required' });
    return;
  }
  const config =
    req.body?.config && typeof req.body.config === 'object' && !Array.isArray(req.body.config)
      ? req.body.config
      : {};
  const result = await scoutConsolePost(`/api/admin/connectors/${connectorId}/enable`, {
    account_id: accountId,
    config,
  });
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Enable failed' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.post('/connectors/:id/disable', async (req, res) => {
  if (!requireScoutApiKey(res)) return;
  const connectorId = String(req.params.id ?? '').trim();
  const accountId = parseAccountId(req.body?.account_id);
  if (!accountId) {
    res.status(400).json({ ok: false, error: 'account_id required' });
    return;
  }
  const result = await scoutConsolePost(`/api/admin/connectors/${connectorId}/disable`, {
    account_id: accountId,
  });
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Disable failed' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.get('/connectors/:id/health', async (req, res) => {
  if (!requireScoutApiKey(res)) return;
  const connectorId = String(req.params.id ?? '').trim();
  const accountId = parseAccountId(req.query.account_id);
  if (!accountId) {
    res.status(400).json({ ok: false, error: 'account_id required' });
    return;
  }
  const result = await scoutConsoleGetDetailed(
    `/api/admin/connectors/${connectorId}/health${connectorAccountQuery(accountId)}`,
  );
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Health check failed' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.post('/connectors/:id/test', async (req, res) => {
  if (!requireScoutApiKey(res)) return;
  const connectorId = String(req.params.id ?? '').trim();
  const accountId = parseAccountId(req.body?.account_id);
  if (!accountId) {
    res.status(400).json({ ok: false, error: 'account_id required' });
    return;
  }
  const result = await scoutConsolePost(`/api/admin/connectors/${connectorId}/test`, {
    account_id: accountId,
  });
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Test push failed' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.post('/scout-pairing', (req, res) => {
  const { scoutApiKey } = req.body as { scoutApiKey?: string };
  const key = (scoutApiKey ?? '').trim();

  if (!key) {
    res.redirect('/settings?scout_pair_err=' + encodeURIComponent('Paste your Labyrinth Scout API key'));
    return;
  }

  try {
    setEnvVar(OPS_ENV_PATH, 'SCOUT_API_KEY', key);
    res.redirect('/settings?scout_pair_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings?scout_pair_err=' + encodeURIComponent('Failed: ' + msg));
  }
});

settingsRouter.get('/channel-shield', async (req, res) => {
  try {
    const tablesReady = await channelShieldTablesReady();
    const flashMessages = buildFlashMessages(req.query as Record<string, unknown>);
    if (!tablesReady) {
      res.render('channel-shield', {
        title: 'Channel Shield',
        tablesReady: false,
        byChannel: [],
        quarantineDepth: 0,
        protectionCount: 0,
        pausedCount: 0,
        protections: [],
        heldMessages: [],
        adapters: [],
        channelOptions: listShieldChannelOptions(),
        defaultWorkspaceId: defaultOpsWorkspaceId(),
        sandboxConfigured: Boolean(process.env.WARDEN_SANDBOX_URL || process.env.SCOUT_WARDEN_URL),
        flashMessages,
      });
      return;
    }

    const [metrics, protections, adapters, heldMessages] = await Promise.all([
      fetchChannelShieldMetrics(),
      listChannelShieldProtections(100),
      shieldAdaptersHealthViaCore(),
      listHeldShieldMessages(50),
    ]);

    res.render('channel-shield', {
      title: 'Channel Shield',
      tablesReady: true,
      byChannel: metrics.byChannel,
      quarantineDepth: metrics.quarantineDepth,
      protectionCount: metrics.protectionCount,
      pausedCount: metrics.pausedCount,
      protections,
      heldMessages,
      adapters,
      channelOptions: listShieldChannelOptions(),
      defaultWorkspaceId: defaultOpsWorkspaceId(),
      sandboxConfigured: Boolean(process.env.WARDEN_SANDBOX_URL || process.env.SCOUT_WARDEN_URL),
      flashMessages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

settingsRouter.post('/channel-shield/pause', async (req, res) => {
  const id = String(req.body?.protectionId ?? '').trim();
  if (!UUID_RE.test(id)) {
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Invalid protection id'));
    return;
  }
  try {
    const row = await setProtectionStatus(id, 'paused');
    if (!row) {
      res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Protection not found'));
      return;
    }
    res.redirect('/settings/channel-shield?shield_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent(msg));
  }
});

settingsRouter.post('/channel-shield/resume', async (req, res) => {
  const id = String(req.body?.protectionId ?? '').trim();
  if (!UUID_RE.test(id)) {
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Invalid protection id'));
    return;
  }
  try {
    const row = await setProtectionStatus(id, 'active');
    if (!row) {
      res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Protection not found'));
      return;
    }
    res.redirect('/settings/channel-shield?shield_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent(msg));
  }
});

settingsRouter.post('/channel-shield/create', async (req, res) => {
  try {
    await createShieldProtection({
      channel: String(req.body?.channel ?? ''),
      externalKey: String(req.body?.externalKey ?? ''),
      mode: String(req.body?.mode ?? 'protect') as 'protect' | 'monitor' | 'off',
      workspaceId: String(req.body?.workspaceId ?? '').trim() || undefined,
    });
    res.redirect('/settings/channel-shield?shield_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent(msg));
  }
});

settingsRouter.post('/channel-shield/delete', async (req, res) => {
  const id = String(req.body?.protectionId ?? '').trim();
  if (!UUID_RE.test(id)) {
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Invalid protection id'));
    return;
  }
  try {
    const ok = await deleteShieldProtection(id);
    if (!ok) {
      res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Protection not found'));
      return;
    }
    res.redirect('/settings/channel-shield?shield_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent(msg));
  }
});

settingsRouter.post('/channel-shield/release', async (req, res) => {
  const id = String(req.body?.messageId ?? '').trim();
  if (!UUID_RE.test(id)) {
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Invalid message id'));
    return;
  }
  try {
    const ok = await setHeldMessageStatus(id, 'released');
    if (!ok) {
      res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Held message not found'));
      return;
    }
    res.redirect('/settings/channel-shield?shield_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent(msg));
  }
});

settingsRouter.post('/channel-shield/destroy', async (req, res) => {
  const id = String(req.body?.messageId ?? '').trim();
  if (!UUID_RE.test(id)) {
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Invalid message id'));
    return;
  }
  try {
    const ok = await setHeldMessageStatus(id, 'destroyed');
    if (!ok) {
      res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Held message not found'));
      return;
    }
    res.redirect('/settings/channel-shield?shield_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent(msg));
  }
});

settingsRouter.post('/channel-shield/seed-demo', async (req, res) => {
  const id = String(req.body?.protectionId ?? '').trim();
  if (!UUID_RE.test(id)) {
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Create a protection first, then seed a demo held message'));
    return;
  }
  try {
    const msg = await seedDemoHeldMessage(id);
    if (!msg) {
      res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent('Protection not found'));
      return;
    }
    res.redirect('/settings/channel-shield?shield_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings/channel-shield?shield_err=' + encodeURIComponent(msg));
  }
});

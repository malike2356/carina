import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { Router } from 'express';
import { scoutGet, scoutGetDetailed, scoutPut, scoutPost } from '../lib/scout.js';
import { carinaGet, carinaJson, carinaOpsTokenSet, carinaPut } from '../lib/carina.js';
import { autoPairCarinaFromLocalCore, testCarinaConnection } from '../lib/carina-pairing.js';
import { coreEnvReadable, resolveCoreEnvPath } from '../lib/core-env.js';
import { OPS_ENV_PATH, setEnvVar } from '../lib/env.js';

export const settingsRouter = Router();

const SCOUT_HTPASSWD =
  process.env.SCOUT_HTPASSWD_FILE ?? '/home/malike/apps/console.labyrinthscout.com/.htpasswd';
const SCOUT_HTPASSWD_USER = 'malike';

settingsRouter.get('/', async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  let coreWebPasswordSet = false;
  let carinaConnected = false;
  if (carinaOpsTokenSet()) {
    carinaConnected = await testCarinaConnection();
    if (carinaConnected) {
      const response = await carinaGet('/api/ops/web-password');
      const parsed = await carinaJson<{ set?: boolean }>(response);
      coreWebPasswordSet = parsed.ok && parsed.data?.set === true;
    }
  }
  res.render('settings', {
    title: 'Settings',
    carinaApiUrl: process.env.CARINA_API_URL ?? 'http://localhost:3333',
    carinaAndroidApkUrl: process.env.CARINA_ANDROID_APK_URL ?? '',
    scoutUrl: process.env.SCOUT_URL ?? 'http://localhost:4444',
    adminPasswordSet: adminPassword !== 'changeme',
    coreWebPasswordSet,
    skillAutoWrite: process.env.SKILL_AUTO_WRITE === 'true',
    port: process.env.PORT ?? '4000',
    scoutOk: req.query['scout_ok'] === '1',
    scoutErr: typeof req.query['scout_err'] === 'string' ? req.query['scout_err'] : '',
    scoutPaired: Boolean(process.env.SCOUT_API_KEY),
    scoutPairOk: req.query['scout_pair_ok'] === '1',
    scoutPairErr: typeof req.query['scout_pair_err'] === 'string' ? req.query['scout_pair_err'] : '',
    carinaPaired: carinaOpsTokenSet(),
    carinaConnected,
    coreEnvReadable: coreEnvReadable(),
    coreEnvPath: resolveCoreEnvPath(),
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
  });
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
  const data = (await scoutGet('/api/status')) as { instances?: unknown[] } | null;
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
  const result = await scoutGetDetailed('/api/admin/alert-channels');
  if (!result.ok) {
    res.status(result.status || 502).json({ ok: false, error: result.error ?? 'Scout unreachable' });
    return;
  }
  res.json({ ok: true, ...(result.data as Record<string, unknown>) });
});

settingsRouter.put('/alert-channels/:type', async (req, res) => {
  const type = String(req.params.type ?? '');
  if (!['telegram', 'email', 'slack'].includes(type)) {
    res.status(400).json({ ok: false, error: 'Invalid channel type' });
    return;
  }
  if (!process.env.SCOUT_API_KEY) {
    res.status(400).json({ ok: false, error: 'SCOUT_API_KEY not set' });
    return;
  }
  const result = await scoutPut(`/api/admin/alert-channels/${type}`, req.body ?? {});
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
  const result = await scoutPut('/api/admin/alert-channels/platform', req.body ?? {});
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
  const data = await scoutPost('/api/admin/alert-test', { severity });
  if (!data) {
    res.json({ ok: false, error: 'Alert test failed or Scout unreachable' });
    return;
  }
  res.json({ ok: true, ...(data as Record<string, unknown>) });
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

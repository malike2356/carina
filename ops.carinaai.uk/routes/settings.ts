import { writeFileSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { scoutGet } from '../lib/scout.js';

export const settingsRouter = Router();

const SCOUT_HTPASSWD =
  process.env.SCOUT_HTPASSWD_FILE ?? '/home/malike/apps/console.labyrinthscout.com/.htpasswd';
const SCOUT_HTPASSWD_USER = 'malike';

const __opsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENV_PATH = path.join(__opsDir, '.env');

function setEnvVar(envPath: string, key: string, value: string): void {
  const content = readFileSync(envPath, 'utf8');
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const updated = pattern.test(content) ? content.replace(pattern, line) : content.trimEnd() + `\n${line}\n`;
  writeFileSync(envPath, updated, { encoding: 'utf8', mode: 0o600 });
  process.env[key] = value;
}

settingsRouter.get('/', (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  res.render('settings', {
    title: 'Settings',
    carinaApiUrl: process.env.CARINA_API_URL ?? 'http://localhost:3333',
    scoutUrl: process.env.SCOUT_URL ?? 'http://localhost:4444',
    adminPasswordSet: adminPassword !== 'changeme',
    skillAutoWrite: process.env.SKILL_AUTO_WRITE === 'true',
    port: process.env.PORT ?? '4000',
    scoutOk: req.query['scout_ok'] === '1',
    scoutErr: typeof req.query['scout_err'] === 'string' ? req.query['scout_err'] : '',
    scoutPaired: Boolean(process.env.SCOUT_API_KEY),
    scoutPairOk: req.query['scout_pair_ok'] === '1',
    scoutPairErr: typeof req.query['scout_pair_err'] === 'string' ? req.query['scout_pair_err'] : '',
  });
});

settingsRouter.post('/test-carina', async (_req, res) => {
  const carinaUrl = process.env.CARINA_API_URL ?? 'http://localhost:3333';
  try {
    const r = await fetch(`${carinaUrl}/api/providers`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      res.json({ ok: false, error: `HTTP ${r.status}` });
      return;
    }
    const data = (await r.json()) as {
      providers?: string[];
      active?: string;
    };
    res.json({
      ok: true,
      providers: data.providers ?? [],
      active: data.active ?? null,
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

settingsRouter.post('/scout-pairing', (req, res) => {
  const { scoutApiKey } = req.body as { scoutApiKey?: string };
  const key = (scoutApiKey ?? '').trim();

  if (!key) {
    res.redirect('/settings?scout_pair_err=' + encodeURIComponent('Paste your Labyrinth Scout API key'));
    return;
  }

  try {
    setEnvVar(ENV_PATH, 'SCOUT_API_KEY', key);
    res.redirect('/settings?scout_pair_ok=1');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.redirect('/settings?scout_pair_err=' + encodeURIComponent('Failed: ' + msg));
  }
});

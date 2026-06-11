import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { CARINA_ENV_PATH, CARINA_HOME } from '../../config/paths.js';
import { loadLocalEnv } from '../config/env.js';

type Check = { name: string; ok: boolean; detail: string };

async function checkHttp(url: string, headers?: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runDoctor(): Promise<void> {
  loadLocalEnv();
  const checks: Check[] = [];

  const nodeOk = Number(process.versions.node.split('.')[0]) >= 22;
  checks.push({
    name: 'Node.js >= 22',
    ok: nodeOk,
    detail: process.versions.node,
  });

  checks.push({
    name: 'CARINA_HOME',
    ok: fs.existsSync(CARINA_HOME),
    detail: CARINA_HOME,
  });

  checks.push({
    name: '.env file',
    ok: fs.existsSync(CARINA_ENV_PATH),
    detail: CARINA_ENV_PATH,
  });

  const hasLlm = Boolean(
    process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
  );
  checks.push({
    name: 'LLM API key',
    ok: hasLlm,
    detail: hasLlm ? 'configured' : 'set DEEPSEEK_API_KEY or ANTHROPIC_API_KEY or OPENAI_API_KEY',
  });

  const localMode = process.env.CARINA_LOCAL_MODE === 'true';
  const skipPg = process.env.CARINA_SKIP_POSTGRES === 'true' || localMode;
  if (skipPg) {
    checks.push({
      name: 'Postgres',
      ok: true,
      detail: 'skipped (local/sqlite mode)',
    });
  } else {
    let pgOk = false;
    try {
      const { initDb, pool } = await import('../../memory/db.js');
      await initDb();
      await pool.query('SELECT 1');
      pgOk = true;
      await pool.end();
    } catch (err) {
      checks.push({
        name: 'Postgres',
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    if (pgOk) {
      checks.push({ name: 'Postgres', ok: true, detail: 'connected' });
    }
  }

  try {
    const { hasToolsetsConfig, describePlatformToolsets } = await import('../../tools/toolset-config.js');
    if (hasToolsetsConfig()) {
      const web = describePlatformToolsets('web');
      const telegram = describePlatformToolsets('telegram');
      checks.push({
        name: 'Toolsets',
        ok: true,
        detail: `web=${web.toolCount} tools, telegram=${telegram.toolCount} tools`,
      });
    } else {
      const preset = describePlatformToolsets('default');
      checks.push({
        name: 'Toolsets',
        ok: true,
        detail: `least-privilege preset (${preset.toolCount} tools; run: carina tools menu)`,
      });
    }
  } catch (err) {
    checks.push({
      name: 'Toolsets',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const { getCredentialPoolManager } = await import('../../credentials/pool-manager.js');
    const { PROVIDER_DEFINITIONS } = await import('../../brain/provider-registry.js');
    const mgr = getCredentialPoolManager();
    const pooled = PROVIDER_DEFINITIONS.filter((d) => mgr.poolSize(d.name, process.env[d.apiKeyEnv] ?? '', process.env[d.apiKeysPoolEnv]) > 1);
    checks.push({
      name: 'Credential pools',
      ok: true,
      detail: pooled.length > 0
        ? `${pooled.length} provider(s) with multi-key pools`
        : 'single-key mode (use *_API_KEYS for pools)',
    });
  } catch (err) {
    checks.push({
      name: 'Credential pools',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const { initMemoryBackend, getMemoryBackend } = await import('../../memory/backends/index.js');
    initMemoryBackend();
    const mem = getMemoryBackend();
    checks.push({
      name: 'Memory backend',
      ok: mem.isConfigured(),
      detail: `${mem.displayName} (${mem.name})`,
    });
  } catch (err) {
    checks.push({
      name: 'Memory backend',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const redisUrl = process.env.REDIS_URL ?? '';
  if (redisUrl) {
    let redisOk = false;
    try {
      const { initRedis, getRedis } = await import('../../memory/redis.js');
      await initRedis();
      const r = getRedis();
      if (r) await r.ping();
      redisOk = true;
      r?.disconnect();
    } catch (err) {
      checks.push({
        name: 'Redis',
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    if (redisOk) checks.push({ name: 'Redis', ok: true, detail: 'connected' });
  } else {
    checks.push({ name: 'Redis', ok: true, detail: 'optional (not set)' });
  }

  const labyrinthEnabled = process.env.LABYRINTH_ENABLED === 'true';
  if (labyrinthEnabled) {
    const url = (process.env.LABYRINTH_URL ?? '').trim();
    const apiKey = (process.env.LABYRINTH_API_KEY ?? '').trim();
    if (!url || !apiKey) {
      checks.push({
        name: 'Scout integration',
        ok: false,
        detail: 'LABYRINTH_ENABLED=true but LABYRINTH_URL or LABYRINTH_API_KEY missing',
      });
    } else {
      const scoutOk = await checkHttp(
        `${url.replace(/\/$/, '')}/api/status`,
        { 'X-Scout-Key': apiKey },
      );
      checks.push({
        name: 'Scout integration',
        ok: scoutOk,
        detail: scoutOk ? `reachable (${url})` : `enabled but unreachable (${url})`,
      });
    }
  } else {
    checks.push({
      name: 'Scout integration',
      ok: true,
      detail: 'disabled (recommended until Scout is configured)',
    });
  }

  const webPort = process.env.WEB_PORT ?? '3000';
  const webOk = await checkHttp(`http://127.0.0.1:${webPort}/api/health`);
  checks.push({
    name: 'Web gateway',
    ok: webOk,
    detail: webOk ? `http://localhost:${webPort}` : `not running (start: carina web)`,
  });

  const baileysAuth = path.join(CARINA_HOME, 'baileys-auth');
  if (process.env.BAILEYS_WHATSAPP_ENABLED === 'true') {
    checks.push({
      name: 'WhatsApp Baileys auth',
      ok: fs.existsSync(baileysAuth),
      detail: fs.existsSync(baileysAuth) ? baileysAuth : 'run: carina whatsapp setup',
    });
  }

  console.log(chalk.bold(`\nCarina doctor (${os.hostname()})\n`));
  let failed = 0;
  for (const c of checks) {
    const icon = c.ok ? chalk.green('ok') : chalk.red('FAIL');
    console.log(`  ${icon}  ${c.name}: ${c.detail}`);
    if (!c.ok) failed++;
  }
  console.log(failed === 0
    ? chalk.green('\nAll checks passed.\n')
    : chalk.yellow(`\n${failed} check(s) need attention.\n`));
  if (failed > 0) process.exit(1);
}

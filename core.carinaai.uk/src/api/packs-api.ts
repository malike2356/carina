import fs from 'fs/promises';
import path from 'path';
import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';

export const packsApiRouter: ExpressRouter = Router();

const PACKS_DIR = path.join(process.cwd(), 'src', 'skills', 'packs');
const INSTALLED_TABLE = 'installed_packs';
const PACK_CONFIG_TABLE = 'pack_config';

interface PackMeta {
  name: string;
  version: string;
  description: string;
  author: string;
  skill_count: number;
  download_count: number;
}

type PackRequest = Request & { tenantId?: string };

function packAuth(req: PackRequest, res: Response, next: NextFunction): void {
  if (req.session?.webAuthed) {
    req.tenantId = '__operator__';
    next();
    return;
  }
  if (req.session?.hostedAccountId) {
    req.tenantId = req.session.hostedAccountId;
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function resolveTenantId(req: PackRequest): string {
  return req.tenantId ?? 'default';
}

async function loadBundledPacks(): Promise<PackMeta[]> {
  const packs: PackMeta[] = [];
  let entries: Array<{ name: string; isDirectory: () => boolean }>;
  try {
    entries = await fs.readdir(PACKS_DIR, { withFileTypes: true });
  } catch {
    return packs;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = await fs.readFile(path.join(PACKS_DIR, entry.name, 'pack.json'), 'utf-8');
      const meta = JSON.parse(raw) as Record<string, unknown>;
      packs.push({
        name: String(meta.name ?? entry.name),
        version: String(meta.version ?? '1.0.0'),
        description: String(meta.description ?? ''),
        author: String(meta.author ?? 'Carina'),
        skill_count: Number(meta.skillCount ?? meta.skill_count ?? 0),
        download_count: 0,
      });
    } catch {
      // skip invalid pack folders
    }
  }

  return packs.sort((a, b) => a.name.localeCompare(b.name));
}

function installedFromConfig(bundled: PackMeta[]): Array<{
  pack_name: string;
  version: string;
  installed_at: string;
  status: string;
}> {
  const byName = new Map(bundled.map((p) => [p.name, p]));
  return config.carina.activePacks.map((name) => ({
    pack_name: name,
    version: byName.get(name)?.version ?? '1.0.0',
    installed_at: new Date().toISOString(),
    status: 'installed',
  }));
}

packsApiRouter.use(packAuth);

packsApiRouter.get('/available', async (_req, res) => {
  const packs = await loadBundledPacks();
  res.json({ packs });
});

packsApiRouter.get('/installed', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  const bundled = await loadBundledPacks();

  if (tenantId === '__operator__') {
    res.json({ installed: installedFromConfig(bundled) });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT pack_name, version, installed_at, status
       FROM ${INSTALLED_TABLE}
       WHERE tenant_id = $1
       ORDER BY installed_at DESC`,
      [tenantId],
    );
    if ((result.rowCount ?? 0) > 0) {
      res.json({ installed: result.rows });
      return;
    }
  } catch {
    // fall through to config-backed list
  }

  res.json({ installed: installedFromConfig(bundled) });
});

packsApiRouter.get('/:name', async (req, res) => {
  const packs = await loadBundledPacks();
  const pack = packs.find((p) => p.name === req.params.name);
  if (!pack) return res.status(404).json({ error: 'Not found' });
  res.json(pack);
});

packsApiRouter.post('/:name/install', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  const packName = req.params.name;
  const bundled = await loadBundledPacks();
  const pack = bundled.find((p) => p.name === packName);
  if (!pack) return res.status(404).json({ error: 'Pack not found' });

  if (tenantId === '__operator__') {
    res.status(400).json({
      error: 'Operator instances enable packs via ACTIVE_SKILL_PACKS in server config, then restart Carina.',
    });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO ${INSTALLED_TABLE} (tenant_id, pack_name, version, status, installed_at)
       VALUES ($1, $2, $3, 'installed', NOW())
       ON CONFLICT (tenant_id, pack_name)
       DO UPDATE SET version = $3, status = 'installed', installed_at = NOW()`,
      [tenantId, packName, pack.version],
    );
    res.json({ installed: true, pack: packName, version: pack.version });
  } catch (err) {
    console.error('[packs-api] install failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Install failed' });
  }
});

packsApiRouter.post('/:name/uninstall', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  if (tenantId === '__operator__') {
    res.status(400).json({
      error: 'Operator instances disable packs via ACTIVE_SKILL_PACKS in server config, then restart Carina.',
    });
    return;
  }

  try {
    await pool.query(
      `DELETE FROM ${INSTALLED_TABLE} WHERE tenant_id = $1 AND pack_name = $2`,
      [tenantId, req.params.name],
    );
    await pool.query(
      `DELETE FROM ${PACK_CONFIG_TABLE} WHERE tenant_id = $1 AND pack_name = $2`,
      [tenantId, req.params.name],
    );
    res.json({ uninstalled: true });
  } catch (err) {
    console.error('[packs-api] uninstall failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Uninstall failed' });
  }
});

packsApiRouter.get('/:name/config', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  try {
    const result = await pool.query(
      `SELECT config FROM ${PACK_CONFIG_TABLE}
       WHERE tenant_id = $1 AND pack_name = $2`,
      [tenantId, req.params.name],
    );
    res.json({ config: result.rows[0]?.config ?? {} });
  } catch {
    res.json({ config: {} });
  }
});

packsApiRouter.put('/:name/config', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  const packConfig = req.body ?? {};
  try {
    await pool.query(
      `INSERT INTO ${PACK_CONFIG_TABLE} (tenant_id, pack_name, config, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, pack_name)
       DO UPDATE SET config = $3, updated_at = NOW()`,
      [tenantId, req.params.name, JSON.stringify(packConfig)],
    );
    res.json({ saved: true });
  } catch (err) {
    console.error('[packs-api] config save failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Config save failed' });
  }
});

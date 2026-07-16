import fs from 'fs/promises';
import path from 'path';
import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import {
  deleteCustomResource,
  listCustomResources,
  loadAllUserResources,
  saveCustomResource,
  type CustomResourceKind,
} from '../skills/user-resources.js';
import {
  guiInstalledPayload,
  installedRowsFromActivePacks,
} from './packs-api.helpers.js';
import {
  getLastOperatorPackAudit,
  getOperatorActivePacks,
  installOperatorPack,
  listOperatorInstalledPacks,
  OPERATOR_TENANT_ID,
  syncOperatorActivePacks,
  uninstallOperatorPack,
} from '../skills/operator-pack-store.js';
import { enablePackRuntime, listAvailablePacks } from '../skills/index.js';

export const packsApiRouter: ExpressRouter = Router();

const PACKS_DIR = path.join(process.cwd(), 'src', 'skills', 'packs');
const INSTALLED_TABLE = 'installed_packs';
const PACK_CONFIG_TABLE = 'pack_config';

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

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
    req.tenantId = OPERATOR_TENANT_ID;
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

function resolvePackActor(req: PackRequest): string {
  if (req.session?.hostedAccountId) return `hosted:${req.session.hostedAccountId}`;
  if (req.session?.webAuthed) return 'web-operator';
  return 'operator';
}

function resolvePackSource(req: PackRequest): string {
  return resolveTenantId(req) === OPERATOR_TENANT_ID ? 'packs-ui' : 'hosted-packs-ui';
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

packsApiRouter.use(packAuth);

packsApiRouter.get('/available', async (_req, res) => {
  const packs = await loadBundledPacks();
  res.json({ packs });
});

packsApiRouter.get('/active', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  if (tenantId === OPERATOR_TENANT_ID) {
    const installed = await listOperatorInstalledPacks();
    const active = getOperatorActivePacks();
    const lastChange = await getLastOperatorPackAudit();
    res.json({
      active,
      installed,
      management: 'gui',
      lastChange,
      source: 'persisted',
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT pack_name FROM ${INSTALLED_TABLE}
       WHERE tenant_id = $1 AND status = 'installed'
       ORDER BY installed_at DESC`,
      [tenantId],
    );
    if ((result.rowCount ?? 0) > 0) {
      res.json({
        active: result.rows.map((row) => String(row.pack_name)),
        installed: result.rows,
        management: 'gui',
        source: 'tenant',
      });
      return;
    }
  } catch {
    // fall through
  }

  const bundled = await loadBundledPacks();
  const active = config.carina.activePacks;
  res.json({
    active,
    installed: installedRowsFromActivePacks(bundled, active),
    management: 'gui',
    source: 'env-fallback',
  });
});

packsApiRouter.put('/active', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  const raw = req.body?.packs;
  const packs = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === 'string'
      ? raw.split(',')
      : [];

  if (tenantId === OPERATOR_TENANT_ID) {
    const known = new Set(listAvailablePacks().map((pack) => pack.name));
    const versions = Object.fromEntries(listAvailablePacks().map((pack) => [pack.name, pack.version]));
    const invalid = packs.map((name) => name.trim()).filter(Boolean).filter((name) => !known.has(name));
    if (invalid.length > 0) {
      res.status(400).json({
        error: 'Unknown or incompatible skill packs',
        invalid,
        available: [...known].sort(),
      });
      return;
    }
    try {
      const result = await syncOperatorActivePacks(packs, {
        actor: resolvePackActor(req),
        source: resolvePackSource(req),
        versions,
      });
      res.json({
        ok: true,
        active: result.active,
        added: result.added,
        removed: result.removed,
        lastChange: await getLastOperatorPackAudit(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg || 'Failed to save skill packs' });
    }
    return;
  }

  const bundled = await loadBundledPacks();
  const known = new Set(bundled.map((pack) => pack.name));
  const normalized = [...new Set(packs.map((name) => name.trim()).filter(Boolean))];
  const invalid = normalized.filter((name) => !known.has(name));
  if (invalid.length > 0) {
    res.status(400).json({ error: 'Unknown skill packs', invalid });
    return;
  }

  try {
    await pool.query(`DELETE FROM ${INSTALLED_TABLE} WHERE tenant_id = $1`, [tenantId]);
    for (const name of normalized) {
      const pack = bundled.find((p) => p.name === name);
      await pool.query(
        `INSERT INTO ${INSTALLED_TABLE} (tenant_id, pack_name, version, status, installed_at, updated_at, updated_by)
         VALUES ($1, $2, $3, 'installed', NOW(), NOW(), $4)`,
        [tenantId, name, pack?.version ?? '1.0.0', resolvePackActor(req)],
      );
      await enablePackRuntime(name);
    }
    res.json({ ok: true, active: normalized, management: 'gui' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg || 'Failed to save tenant skill packs' });
  }
});

packsApiRouter.get('/installed', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  const bundled = await loadBundledPacks();

  if (tenantId === OPERATOR_TENANT_ID) {
    const installed = await listOperatorInstalledPacks();
    res.json(guiInstalledPayload(installed));
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
      res.json({ installed: result.rows, management: 'gui' });
      return;
    }
  } catch {
    // fall through to config-backed list
  }

  res.json(guiInstalledPayload(installedRowsFromActivePacks(bundled, config.carina.activePacks)));
});

packsApiRouter.get('/custom', async (_req, res) => {
  try {
    const files = await listCustomResources();
    res.json({ files });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

packsApiRouter.post('/custom/upload', async (req, res) => {
  const kind = String(req.body?.kind ?? '') as CustomResourceKind;
  const filename = String(req.body?.filename ?? '');
  const content = String(req.body?.content ?? '');
  if (kind !== 'skill' && kind !== 'knowledge') {
    res.status(400).json({ error: 'kind must be skill or knowledge' });
    return;
  }
  if (!filename.trim() || !content.trim()) {
    res.status(400).json({ error: 'filename and content are required' });
    return;
  }
  try {
    const file = await saveCustomResource(kind, filename, content);
    res.json({ ok: true, file });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

packsApiRouter.post('/custom/reload', async (_req, res) => {
  try {
    const result = await loadAllUserResources();
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

packsApiRouter.delete('/custom/:kind/:filename', async (req, res) => {
  const kind = req.params.kind as CustomResourceKind;
  if (kind !== 'skill' && kind !== 'knowledge') {
    res.status(400).json({ error: 'Invalid kind' });
    return;
  }
  try {
    await deleteCustomResource(kind, req.params.filename);
    res.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

packsApiRouter.get('/:name', async (req, res) => {
  const packs = await loadBundledPacks();
  const pack = packs.find((p) => p.name === req.params.name);
  if (!pack) return res.status(404).json({ error: 'Not found' });
  res.json(pack);
});

packsApiRouter.post('/:name/install', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  const packName = routeParam(req.params.name);
  const bundled = await loadBundledPacks();
  const pack = bundled.find((p) => p.name === packName);
  if (!pack) return res.status(404).json({ error: 'Pack not found' });

  const meta = { actor: resolvePackActor(req), source: resolvePackSource(req) };

  try {
    if (tenantId === OPERATOR_TENANT_ID) {
      await installOperatorPack(packName, pack.version, meta);
    } else {
      await pool.query(
        `INSERT INTO ${INSTALLED_TABLE} (tenant_id, pack_name, version, status, installed_at)
         VALUES ($1, $2, $3, 'installed', NOW())
         ON CONFLICT (tenant_id, pack_name)
         DO UPDATE SET version = $3, status = 'installed', installed_at = NOW()`,
        [tenantId, packName, pack.version],
      );
    }
    await enablePackRuntime(packName);
    res.json({ installed: true, pack: packName, version: pack.version });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[packs-api] install failed:', msg);
    res.status(500).json({ error: msg || 'Install failed' });
  }
});

packsApiRouter.post('/:name/uninstall', async (req: PackRequest, res) => {
  const tenantId = resolveTenantId(req);
  const packName = routeParam(req.params.name);

  const meta = { actor: resolvePackActor(req), source: resolvePackSource(req) };

  try {
    if (tenantId === OPERATOR_TENANT_ID) {
      await uninstallOperatorPack(packName, meta);
    } else {
      await pool.query(
        `DELETE FROM ${INSTALLED_TABLE} WHERE tenant_id = $1 AND pack_name = $2`,
        [tenantId, packName],
      );
      await pool.query(
        `DELETE FROM ${PACK_CONFIG_TABLE} WHERE tenant_id = $1 AND pack_name = $2`,
        [tenantId, packName],
      );
    }
    res.json({ uninstalled: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[packs-api] uninstall failed:', msg);
    res.status(500).json({ error: msg || 'Uninstall failed' });
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

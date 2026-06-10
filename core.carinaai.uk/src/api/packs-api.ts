import { Router, type Request, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';

export const packsApiRouter: ExpressRouter = Router();

const PACKS_TABLE = 'skill_packs';
const INSTALLED_TABLE = 'installed_packs';
const PACK_CONFIG_TABLE = 'pack_config';

type TenantRequest = Request & {
  tenantId?: string;
  hostedUser?: { id: string };
};

function resolveTenantId(req: TenantRequest): string {
  return req.tenantId ?? req.hostedUser?.id ?? 'default';
}

// ── List available packs ──
packsApiRouter.get('/available', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT name, version, description, author, skill_count, download_count, created_at
       FROM ${PACKS_TABLE} ORDER BY name`,
    );
    res.json({ packs: result.rows });
  } catch {
    res.json({ packs: [] });
  }
});

// ── List installed packs ──
packsApiRouter.get('/installed', async (req: TenantRequest, res) => {
  const tenantId = resolveTenantId(req);
  try {
    const result = await pool.query(
      `SELECT pack_name, version, installed_at, status
       FROM ${INSTALLED_TABLE}
       WHERE tenant_id = $1
       ORDER BY installed_at DESC`,
      [tenantId],
    );
    res.json({ installed: result.rows });
  } catch {
    res.json({ installed: [] });
  }
});

// ── Pack detail ──
packsApiRouter.get('/:name', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT name, version, description, author, skill_count, download_count
       FROM ${PACKS_TABLE} WHERE name = $1`,
      [req.params.name],
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to load pack' });
  }
});

// ── Install ──
packsApiRouter.post('/:name/install', async (req: TenantRequest, res) => {
  const tenantId = resolveTenantId(req);
  const packName = req.params.name;
  try {
    // Check pack exists
    const pkg = await pool.query(`SELECT name, version FROM ${PACKS_TABLE} WHERE name = $1`, [packName]);
    if ((pkg.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Pack not found' });

    const version = pkg.rows[0].version;

    // Upsert installed record
    await pool.query(
      `INSERT INTO ${INSTALLED_TABLE} (tenant_id, pack_name, version, status, installed_at)
       VALUES ($1, $2, $3, 'installed', NOW())
       ON CONFLICT (tenant_id, pack_name)
       DO UPDATE SET version = $3, status = 'installed', installed_at = NOW()`,
      [tenantId, packName, version],
    );

    res.json({ installed: true, pack: packName, version });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Install failed' });
  }
});

// ── Uninstall ──
packsApiRouter.post('/:name/uninstall', async (req: TenantRequest, res) => {
  const tenantId = resolveTenantId(req);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Uninstall failed' });
  }
});

// ── Get config ──
packsApiRouter.get('/:name/config', async (req: TenantRequest, res) => {
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

// ── Set config ──
packsApiRouter.put('/:name/config', async (req: TenantRequest, res) => {
  const tenantId = resolveTenantId(req);
  const config = req.body ?? {};
  try {
    await pool.query(
      `INSERT INTO ${PACK_CONFIG_TABLE} (tenant_id, pack_name, config, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tenant_id, pack_name)
       DO UPDATE SET config = $3, updated_at = NOW()`,
      [tenantId, req.params.name, JSON.stringify(config)],
    );
    res.json({ saved: true });
  } catch {
    res.status(500).json({ error: 'Config save failed' });
  }
});

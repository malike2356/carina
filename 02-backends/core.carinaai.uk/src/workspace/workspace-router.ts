import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';
import { isBusinessPlan } from '../billing/plan-tier.js';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { getSubscription } from '../workers/aiva-subscription-store.js';
import { notifyCustomDomainVerified } from '../email/email-triggers.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const DEFAULT_GOVERNANCE = {
  volumeSpikeThreshold: 50,
  escalationRateThreshold: 0.3,
  escalationBurstWindow: 5,
  escalationBurstCount: 3,
  ignoreSignalTypes: [] as string[],
};

function uploadsDir(): string {
  return process.env.CARINA_UPLOADS_DIR?.trim() || path.join(process.cwd(), 'data', 'uploads');
}

function logosDir(): string {
  return path.join(uploadsDir(), 'logos');
}

function publicLogoUrl(workspaceId: string, ext: string): string {
  const base = (process.env.CARINA_PUBLIC_URL ?? process.env.CARINA_CORE_PUBLIC_URL ?? 'https://core.carinaai.uk').replace(/\/$/, '');
  return `${base}/uploads/logos/${workspaceId}.${ext}`;
}

type WorkspaceRequest = Request & { workspaceId?: string };

function resolveWorkspaceId(req: WorkspaceRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function requireWorkspace(req: WorkspaceRequest, res: Response, next: NextFunction): void {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header or body)' });
    return;
  }
  if (!UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Invalid workspaceId' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

async function requireBusinessPlan(req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> {
  const sub = await getSubscription(req.workspaceId!);
  if (!isBusinessPlan(sub?.planTier ?? 'trial')) {
    res.status(403).json({ error: 'Business plan required', code: 'PLAN_UPGRADE_REQUIRED' });
    return;
  }
  next();
}

function mapBrandingRow(row: Record<string, unknown> | undefined, workspaceId: string) {
  return {
    workspaceId,
    logoUrl: row?.logo_url ? String(row.logo_url) : null,
    primaryColor: row?.primary_color ? String(row.primary_color) : '#1a5f7a',
    companyName: row?.company_name ? String(row.company_name) : null,
    customDomain: row?.custom_domain ? String(row.custom_domain) : null,
    customDomainVerified: Boolean(row?.custom_domain_verified),
    hideVerloxAttribution: Boolean(row?.hide_verlox_attribution),
  };
}

function mapGovernanceRow(row: Record<string, unknown> | undefined) {
  if (!row) return { ...DEFAULT_GOVERNANCE };
  return {
    volumeSpikeThreshold: Number(row.volume_spike_threshold ?? DEFAULT_GOVERNANCE.volumeSpikeThreshold),
    escalationRateThreshold: Number(row.escalation_rate_threshold ?? DEFAULT_GOVERNANCE.escalationRateThreshold),
    escalationBurstWindow: Number(row.escalation_burst_window ?? DEFAULT_GOVERNANCE.escalationBurstWindow),
    escalationBurstCount: Number(row.escalation_burst_count ?? DEFAULT_GOVERNANCE.escalationBurstCount),
    ignoreSignalTypes: Array.isArray(row.ignore_signal_types)
      ? row.ignore_signal_types.map(String)
      : [],
  };
}

export async function getWorkspaceBranding(workspaceId: string) {
  const result = await pool.query(
    'SELECT * FROM workspace_branding WHERE workspace_id = $1',
    [workspaceId],
  );
  return mapBrandingRow(result.rows[0] as Record<string, unknown> | undefined, workspaceId);
}

export const workspaceRouter: ExpressRouter = Router();
workspaceRouter.use(requireCloudProxy);
workspaceRouter.use(requireWorkspace);

workspaceRouter.get('/branding', async (req: WorkspaceRequest, res: Response) => {
  const branding = await getWorkspaceBranding(req.workspaceId!);
  const sub = await getSubscription(req.workspaceId!);
  res.json({ branding, planTier: sub?.planTier ?? 'trial' });
});

workspaceRouter.patch('/branding', requireBusinessPlan, async (req: WorkspaceRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const primaryColor = req.body?.primaryColor;
  const companyName = req.body?.companyName;
  const customDomain = req.body?.customDomain;
  const hideVerloxAttribution = req.body?.hideVerloxAttribution;

  if (primaryColor !== undefined && !HEX_COLOR_RE.test(String(primaryColor))) {
    res.status(400).json({ error: 'primaryColor must be a hex color like #1a5f7a' });
    return;
  }

  await pool.query(
    `INSERT INTO workspace_branding (workspace_id, primary_color, company_name, custom_domain, hide_verlox_attribution, updated_at)
     VALUES ($1, COALESCE($2, '#1a5f7a'), $3, $4, COALESCE($5, false), NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       primary_color = COALESCE($2, workspace_branding.primary_color),
       company_name = COALESCE($3, workspace_branding.company_name),
       custom_domain = COALESCE($4, workspace_branding.custom_domain),
       hide_verlox_attribution = COALESCE($5, workspace_branding.hide_verlox_attribution),
       updated_at = NOW()`,
    [
      workspaceId,
      primaryColor ?? null,
      companyName !== undefined ? String(companyName).trim() || null : null,
      customDomain !== undefined ? String(customDomain).trim().toLowerCase() || null : null,
      hideVerloxAttribution !== undefined ? Boolean(hideVerloxAttribution) : null,
    ],
  );

  if (customDomain !== undefined && String(customDomain).trim()) {
    await pool.query(
      'UPDATE workspace_branding SET custom_domain_verified = false WHERE workspace_id = $1',
      [workspaceId],
    );
  }

  res.json({ branding: await getWorkspaceBranding(workspaceId) });
});

workspaceRouter.post('/branding/logo', requireBusinessPlan, async (req: WorkspaceRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const data = String(req.body?.data ?? '').trim();
  const mime = String(req.body?.mimeType ?? 'image/png').toLowerCase();
  if (!data) {
    res.status(400).json({ error: 'data (base64 image) is required' });
    return;
  }

  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
  if (!allowed.has(mime)) {
    res.status(400).json({ error: 'Unsupported image type' });
    return;
  }

  const extByMime: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  const ext = extByMime[mime] ?? 'png';
  const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (buffer.length < 16 || buffer.length > 2 * 1024 * 1024) {
    res.status(400).json({ error: 'Logo must be between 16 bytes and 2MB' });
    return;
  }

  const dir = logosDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${workspaceId}.${ext}`);
  await fs.writeFile(filePath, buffer);

  const logoUrl = publicLogoUrl(workspaceId, ext);
  await pool.query(
    `INSERT INTO workspace_branding (workspace_id, logo_url, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET logo_url = $2, updated_at = NOW()`,
    [workspaceId, logoUrl],
  );

  res.json({ logoUrl });
});

workspaceRouter.delete('/branding/logo', requireBusinessPlan, async (req: WorkspaceRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const existing = await pool.query(
    'SELECT logo_url FROM workspace_branding WHERE workspace_id = $1',
    [workspaceId],
  );
  const logoUrl = existing.rows[0]?.logo_url ? String(existing.rows[0].logo_url) : '';
  if (logoUrl) {
    const match = logoUrl.match(/\/([^/]+)\.(png|jpg|jpeg|webp|svg)$/i);
    if (match) {
      await fs.unlink(path.join(logosDir(), `${workspaceId}.${match[2]}`)).catch(() => {});
    }
  }
  await pool.query(
    `INSERT INTO workspace_branding (workspace_id, logo_url, updated_at)
     VALUES ($1, NULL, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET logo_url = NULL, updated_at = NOW()`,
    [workspaceId],
  );
  res.json({ ok: true });
});

workspaceRouter.post('/branding/verify-domain', requireBusinessPlan, async (req: WorkspaceRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const branding = await getWorkspaceBranding(workspaceId);
  const domain = branding.customDomain;
  if (!domain) {
    res.status(400).json({ error: 'customDomain is not set' });
    return;
  }

  const token = crypto.createHash('sha256').update(`${workspaceId}:${domain}`).digest('hex').slice(0, 32);
  const expected = `carina-verify=${token}`;
  let verified = false;
  try {
    const records = await dns.resolveCname(domain);
    verified = records.some((r) => r.toLowerCase().includes(expected.toLowerCase()));
  } catch {
    verified = false;
  }

  if (verified) {
    await pool.query(
      'UPDATE workspace_branding SET custom_domain_verified = true, updated_at = NOW() WHERE workspace_id = $1',
      [workspaceId],
    );
    void notifyCustomDomainVerified({ workspaceId, domain }).catch((err) => {
      console.warn('[branding] domain verify notify failed:', err);
    });
    res.json({ verified: true, cnameExpected: expected });
    return;
  }

  res.json({
    verified: false,
    message: 'CNAME not found.',
    cnameExpected: expected,
  });
});

workspaceRouter.get('/scout-governance', async (req: WorkspaceRequest, res: Response) => {
  const result = await pool.query(
    'SELECT * FROM aiva_scout_governance WHERE workspace_id = $1',
    [req.workspaceId!],
  );
  const sub = await getSubscription(req.workspaceId!);
  res.json({
    rules: mapGovernanceRow(result.rows[0] as Record<string, unknown> | undefined),
    planTier: sub?.planTier ?? 'trial',
  });
});

workspaceRouter.patch('/scout-governance', requireBusinessPlan, async (req: WorkspaceRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const body = req.body ?? {};
  const volumeSpikeThreshold = Number(body.volumeSpikeThreshold ?? DEFAULT_GOVERNANCE.volumeSpikeThreshold);
  const escalationRateThreshold = Number(body.escalationRateThreshold ?? DEFAULT_GOVERNANCE.escalationRateThreshold);
  const escalationBurstWindow = Number(body.escalationBurstWindow ?? DEFAULT_GOVERNANCE.escalationBurstWindow);
  const escalationBurstCount = Number(body.escalationBurstCount ?? DEFAULT_GOVERNANCE.escalationBurstCount);
  const ignoreSignalTypes = Array.isArray(body.ignoreSignalTypes)
    ? body.ignoreSignalTypes.map(String)
    : DEFAULT_GOVERNANCE.ignoreSignalTypes;

  if (volumeSpikeThreshold < 10 || volumeSpikeThreshold > 1000) {
    res.status(400).json({ error: 'volumeSpikeThreshold must be between 10 and 1000' });
    return;
  }
  if (escalationRateThreshold < 0.05 || escalationRateThreshold > 1) {
    res.status(400).json({ error: 'escalationRateThreshold must be between 0.05 and 1.00' });
    return;
  }
  if (escalationBurstWindow < 1 || escalationBurstWindow > 60) {
    res.status(400).json({ error: 'escalationBurstWindow must be between 1 and 60' });
    return;
  }
  if (escalationBurstCount < 1 || escalationBurstCount > 50) {
    res.status(400).json({ error: 'escalationBurstCount must be between 1 and 50' });
    return;
  }

  await pool.query(
    `INSERT INTO aiva_scout_governance (
       workspace_id, volume_spike_threshold, escalation_rate_threshold,
       escalation_burst_window, escalation_burst_count, ignore_signal_types, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6::text[], NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       volume_spike_threshold = $2,
       escalation_rate_threshold = $3,
       escalation_burst_window = $4,
       escalation_burst_count = $5,
       ignore_signal_types = $6::text[],
       updated_at = NOW()`,
    [
      workspaceId,
      volumeSpikeThreshold,
      escalationRateThreshold,
      escalationBurstWindow,
      escalationBurstCount,
      ignoreSignalTypes,
    ],
  );

  const result = await pool.query(
    'SELECT * FROM aiva_scout_governance WHERE workspace_id = $1',
    [workspaceId],
  );
  res.json({ rules: mapGovernanceRow(result.rows[0] as Record<string, unknown>) });
});

export function mountWorkspaceUploads(app: import('express').Express): void {
  const dir = path.join(uploadsDir(), 'logos');
  app.get('/uploads/logos/:filename', async (req, res) => {
    const filename = path.basename(String(req.params.filename));
    if (!/^[0-9a-f-]+\.(png|jpg|jpeg|webp|svg)$/i.test(filename)) {
      res.status(404).end();
      return;
    }
    try {
      const filePath = path.join(dir, filename);
      const ext = path.extname(filename).slice(1).toLowerCase();
      const types: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        svg: 'image/svg+xml',
      };
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      res.type(types[ext] ?? 'application/octet-stream');
      res.send(await fs.readFile(filePath));
    } catch {
      res.status(404).end();
    }
  });
}

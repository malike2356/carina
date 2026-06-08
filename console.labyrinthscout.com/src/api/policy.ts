import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { getLoadedPolicy } from '../security/tool-policy.js';
import { resolveAllowlistForTier, type ToolTier } from '../security/tool-tiers.js';

export const policyRouter: IRouter = Router();

const tenantAllowlists = new Map<string, { tier: ToolTier; allowed: string[]; denied: string[] }>();

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

policyRouter.get('/', (_req, res) => {
  const policy = getLoadedPolicy();
  res.json({
    allowlist: policy.allowlist,
    requireConfirmList: policy.requireConfirmList,
    blocklist: policy.blocklist,
    rateLimit: policy.rateLimit,
    dangerousCommandPatterns: policy.dangerousCommands.map((re) => re.source),
  });
});

policyRouter.get('/allowlist/:tenantId', (req: Request, res: Response) => {
  const tenantId = typeof req.params.tenantId === 'string' ? req.params.tenantId : '';
  const override = tenantAllowlists.get(tenantId);
  const policy = getLoadedPolicy();
  const resolved = resolveAllowlistForTier(
    override?.tier ?? policy.tier,
    override?.allowed ?? policy.allowlist,
    override?.denied ?? policy.blocklist,
  );
  res.json(resolved);
});

policyRouter.put('/allowlist/bulk', (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const tenantIds = parseStringArray(body.tenant_ids);
  const tier = body.tier === 'FREE' || body.tier === 'PRO' || body.tier === 'ENTERPRISE'
    ? body.tier
    : getLoadedPolicy().tier;
  const allowed = parseStringArray(body.allowed);
  const denied = parseStringArray(body.denied);

  for (const tenantId of tenantIds) {
    tenantAllowlists.set(tenantId, { tier, allowed, denied });
  }

  res.json({ ok: true, updated: tenantIds.length });
});

policyRouter.put('/allowlist/:tenantId', (req: Request, res: Response) => {
  const tenantId = typeof req.params.tenantId === 'string' ? req.params.tenantId : '';
  const body = req.body as Record<string, unknown>;
  const tier = body.tier === 'FREE' || body.tier === 'PRO' || body.tier === 'ENTERPRISE'
    ? body.tier
    : getLoadedPolicy().tier;
  const allowed = parseStringArray(body.allowed);
  const denied = parseStringArray(body.denied);

  tenantAllowlists.set(tenantId, { tier, allowed, denied });
  res.json(resolveAllowlistForTier(tier, allowed, denied));
});

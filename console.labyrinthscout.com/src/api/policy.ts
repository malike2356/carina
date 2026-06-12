import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { getLoadedPolicy } from '../security/tool-policy.js';
import { resolveAllowlistForTier, type ToolTier } from '../security/tool-tiers.js';
import { getShieldMode, setShieldMode } from '../security/session-shield.js';
import type { ShieldMode } from '../security/policy-decisions.js';
import { pool } from '../db.js';
import { broadcastEvent, refreshAndBroadcastStats } from './sse.js';
import type { SecurityEventRow } from '../types.js';

export const policyRouter: IRouter = Router();

const VALID_SHIELD_MODES = new Set<ShieldMode>(['observe', 'guard', 'restrict', 'quarantine']);

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

policyRouter.get('/shield/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  const state = await getShieldMode(sessionId);
  res.json(state);
});

policyRouter.put('/shield/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
    if (!sessionId || sessionId.length > 256) {
      res.status(400).json({ error: 'Valid sessionId is required' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const mode = typeof body.mode === 'string' && VALID_SHIELD_MODES.has(body.mode as ShieldMode)
      ? body.mode as ShieldMode
      : null;
    if (!mode) {
      res.status(400).json({ error: 'mode must be one of: observe, guard, restrict, quarantine' });
      return;
    }

    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined;
    const changedBy = typeof body.changed_by === 'string' ? body.changed_by.slice(0, 64) : 'operator';
    const state = await setShieldMode(sessionId, mode, changedBy, reason);

    const evResult = await pool.query<SecurityEventRow>(
      `INSERT INTO security_events
         (severity, source, event_type, description, metadata, session_id)
       VALUES ('warning', 'scout-api', 'shield_mode_changed', $1, $2, $3)
       RETURNING *`,
      [
        `Shield mode set to ${mode}${reason ? `: ${reason}` : ''}`,
        JSON.stringify({ mode, reason, changed_by: changedBy }),
        sessionId,
      ],
    );

    const inserted = evResult.rows[0];
    if (inserted) {
      const event: SecurityEventRow = {
        ...inserted,
        metadata: typeof inserted.metadata === 'object' && inserted.metadata !== null
          ? (inserted.metadata as Record<string, unknown>)
          : {},
        created_at: new Date(inserted.created_at).toISOString(),
      };
      broadcastEvent(event);
      void refreshAndBroadcastStats();
    }

    res.json(state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:policy-shield] Failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

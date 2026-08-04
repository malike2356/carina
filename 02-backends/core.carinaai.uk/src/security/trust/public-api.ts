import { Router, type IRouter, type Request, type Response } from 'express';
import { buildExtendedSecurityTrustState } from './trust-state.js';
import { isScoutMutualIntegrationActive } from '../scout-mode.js';
import { config } from '../../config/index.js';

export const publicTrustRouter: IRouter = Router();

publicTrustRouter.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  res.status(405).json({ error: 'Public trust API is read-only' });
});

publicTrustRouter.get('/', async (_req: Request, res: Response) => {
  if (process.env.CARINA_PUBLIC_TRUST_ENABLED === 'false') {
    res.status(503).json({ error: 'Public trust API is disabled on this instance' });
    return;
  }

  try {
    const state = await buildExtendedSecurityTrustState();
    const payload = {
      generated_at: state.generatedAt,
      instance_id: state.instanceId,
      risk_score: state.verification.unifiedRiskScore,
      risk_tier: state.verification.unifiedRiskTier,
      risk_tier_label: `${state.verification.unifiedRiskTier} risk`,
      monitoring: {
        scout_active: state.labyrinthEnabled && state.scoutConfigured,
        suspended: state.suspended,
        sandbox_policy: state.sandboxPolicyMode,
        policy_version: state.policyVersion.version,
        scout_policy_evaluate: state.availability.scoutPolicyEvaluate,
      },
      metrics: {
        security_audit_entries: state.recentSecurityAudit.length,
        tool_blocklist_count: state.toolPolicy.blocklistCount,
        tool_allowlist_count: state.toolPolicy.allowlistCount,
      },
      identity: state.identity,
      verification: state.verification,
      enforcement: state.enforcement,
      notes: state.notes,
      scout_integration: isScoutMutualIntegrationActive(),
      scout_url: config.labyrinth.url,
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[public-trust] failed:', msg);
    res.status(500).json({ error: 'Trust metrics unavailable' });
  }
});

publicTrustRouter.options('/', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { config } from '../config/index.js';
import { loadReferenceTrustIdentity } from '../trust/load-trust-identity.js';
import { loadLatestTrustVerification } from '../trust/erc8126/load-verifications.js';
import { loadRecentTrustAttestations } from '../trust/load-trust-attestations.js';
import { riskTierFromScore } from '../trust/compute-trust-metrics.js';

export const trustVerifyRouter: IRouter = Router();

const DEFAULT_RISK_THRESHOLD = 40;

function parseThreshold(raw: unknown): number {
  const parsed = parseInt(String(raw ?? DEFAULT_RISK_THRESHOLD), 10);
  if (Number.isNaN(parsed)) return DEFAULT_RISK_THRESHOLD;
  return Math.min(100, Math.max(0, parsed));
}

trustVerifyRouter.get('/:agentId', async (req: Request, res: Response): Promise<void> => {
  if (!config.trust.publicEnabled) {
    res.status(503).json({ error: 'Trust verification API is disabled' });
    return;
  }

  const rawAgentId = req.params.agentId;
  const agentId = (Array.isArray(rawAgentId) ? rawAgentId[0] : rawAgentId)?.trim();
  if (!agentId || !/^\d+$/.test(agentId)) {
    res.status(400).json({ error: 'agentId must be a numeric ERC-8004 token ID' });
    return;
  }

  try {
    const identity = await loadReferenceTrustIdentity();
    const threshold = parseThreshold(req.query.max_risk);

    if (!identity?.registered || identity.agent_id !== agentId) {
      res.status(404).json({
        agent_id: agentId,
        verified: false,
        gate_passed: false,
        reason: 'Agent not registered or not the reference Carina identity',
      });
      return;
    }

    const [verification, attestations] = await Promise.all([
      loadLatestTrustVerification(identity.slug ?? 'carina-reference'),
      loadRecentTrustAttestations(identity.slug ?? 'carina-reference', 1),
    ]);

    const riskScore = verification?.unified_risk_score ?? null;
    const riskTier = riskScore === null ? null : riskTierFromScore(riskScore);
    const gatePassed = riskScore !== null && riskScore <= threshold;

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
      agent_id: agentId,
      verified: Boolean(verification || attestations.length > 0),
      identity_registered: true,
      erc8126_verified: Boolean(verification),
      risk_score: riskScore,
      risk_tier: riskTier,
      max_risk_threshold: threshold,
      gate_passed: gatePassed,
      reason: gatePassed
        ? 'Risk score within acceptable threshold'
        : riskScore === null
          ? 'No on-chain verification yet; configure wallet and run pnpm trust:verify'
          : `Risk score ${riskScore} exceeds threshold ${threshold}`,
      latest_verification_at: verification
        ? new Date(verification.submitted_at).toISOString()
        : null,
      latest_attestation_at: attestations[0]
        ? new Date(attestations[0].submitted_at).toISOString()
        : null,
      spec_url: 'https://erc8126.ai/specification',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[trust-verify] Failed:', msg);
    res.status(500).json({ error: 'Trust verification unavailable' });
  }
});

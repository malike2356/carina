import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import {
  createAuditorLink,
  listActiveAuditorLinks,
  revokeAuditorLink,
  validateAuditorToken,
} from '../compliance/auditor-links.js';
import { streamComplianceExport } from '../compliance/export.js';
import { calculateScoutScore, getComplianceScore } from '../compliance/scoring.js';
import { getSecurityScore } from '../compliance/security-score.js';
import { upsertDigestSubscription } from '../compliance/digest.js';
import { buildTrustCenterPayload } from '../compliance/trust-center.js';

export const complianceSocRouter: IRouter = Router();

function resolveCreatedBy(req: Request): string {
  if (req.scoutAuth?.kind === 'account') return req.scoutAuth.accountId;
  return 'operator';
}

complianceSocRouter.get('/score', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [compliance, security] = await Promise.all([
      getComplianceScore(),
      getSecurityScore(),
    ]);
    const scoutScore = calculateScoutScore(security.score, compliance);

    res.json({
      scoutScore: scoutScore.total,
      securityScore: scoutScore.security,
      complianceScore: scoutScore.compliance,
      compliance: {
        configured: compliance.configured,
        totalControls: compliance.totalControls,
        coveredControls: compliance.coveredControls,
        coveragePercent: compliance.coveragePercent,
        evidenceCount: compliance.evidenceCount,
        lastCollectionAt: compliance.lastCollectionAt,
        evidenceWindow: compliance.evidenceWindow,
        controls: compliance.controls,
        trendData: compliance.trendData,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:score] failed:', msg);
    res.status(500).json({ error: 'Failed to compute compliance score', detail: msg });
  }
});

complianceSocRouter.post('/export', async (_req: Request, res: Response): Promise<void> => {
  try {
    const score = await getComplianceScore();
    if (!score.configured) {
      res.status(400).json({ error: 'Compliance evidence collection not configured' });
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="soc2-evidence-${timestamp}.zip"`);
    await streamComplianceExport(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not configured')) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error('[compliance:export] failed:', msg);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate export', detail: msg });
    }
  }
});

complianceSocRouter.post('/share-link', async (req: Request, res: Response): Promise<void> => {
  try {
    const link = await createAuditorLink(resolveCreatedBy(req));
    res.status(201).json({
      id: link.id,
      url: link.url,
      token: link.token,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:share-link] create failed:', msg);
    res.status(500).json({ error: 'Failed to create share link', detail: msg });
  }
});

complianceSocRouter.delete('/share-link/:token', async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.params.token === 'string' ? req.params.token : '';
  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  try {
    const revoked = await revokeAuditorLink(token);
    if (!revoked) {
      res.status(404).json({ error: 'Link not found or already revoked' });
      return;
    }
    res.json({ revoked: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:share-link] revoke failed:', msg);
    res.status(500).json({ error: 'Failed to revoke share link', detail: msg });
  }
});

complianceSocRouter.get('/share-link', async (_req: Request, res: Response): Promise<void> => {
  try {
    const links = await listActiveAuditorLinks();
    res.json(links.map((l) => ({
      id: l.id,
      url: l.url,
      expiresAt: l.expiresAt,
      accessCount: l.accessCount,
      lastAccessedAt: l.lastAccessedAt,
      createdAt: l.createdAt,
    })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:share-link] list failed:', msg);
    res.status(500).json({ error: 'Failed to list share links', detail: msg });
  }
});

complianceSocRouter.post('/digest/subscribe', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'A valid email is required' });
    return;
  }

  const userId = req.scoutAuth?.kind === 'account'
    ? req.scoutAuth.accountId
    : typeof body.user_id === 'string'
      ? body.user_id
      : 'operator';

  try {
    await upsertDigestSubscription(userId, email);
    res.status(201).json({ subscribed: true, email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:digest] subscribe failed:', msg);
    res.status(500).json({ error: 'Failed to subscribe', detail: msg });
  }
});

export const compliancePublicRouter: IRouter = Router();

compliancePublicRouter.get('/trust-center', async (_req: Request, res: Response): Promise<void> => {
  try {
    const payload = await buildTrustCenterPayload();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:trust-center] failed:', msg);
    res.status(500).json({ error: 'Trust center data unavailable', detail: msg });
  }
});

compliancePublicRouter.get('/auditor/:token', async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.params.token === 'string' ? req.params.token : '';
  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  try {
    const valid = await validateAuditorToken(token);
    if (!valid) {
      res.status(404).json({ error: 'Invalid or expired link' });
      return;
    }

    const score = await getComplianceScore();
    res.json({
      organizationName: process.env.SCOUT_ORG_NAME ?? 'Scout Customer',
      reportDate: new Date().toISOString(),
      totalControls: score.totalControls,
      coveredControls: score.coveredControls,
      coveragePercent: score.coveragePercent,
      evidenceCount: score.evidenceCount,
      evidenceWindow: score.evidenceWindow,
      controls: score.controls.map((c) => ({
        controlId: c.controlId,
        name: c.name,
        covered: c.covered,
        evidenceCount: c.evidenceCount,
        lastEvidenceAt: c.lastEvidenceAt,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compliance:auditor] failed:', msg);
    res.status(500).json({ error: 'Auditor view unavailable', detail: msg });
  }
});

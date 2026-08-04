import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { slotLimitForTier, tierDisplayLabel } from '../billing/aiva-tier.js';
import {
  analyseRoleDescription,
  formatDomainLabel,
  type AnalysedRole,
} from '../provisioning/role-analyser.js';
import { getTierDisplayInfo } from '../provisioning/tier-recommender.js';
import { provisionFromRoleAnalysis } from '../provisioning/provision-from-analysis.js';

export const provisioningWizardRouter: ExpressRouter = Router();

type WizardRequest = Request & { workspaceId?: string };

function requireWizardWorkspace(req: WizardRequest, res: Response, next: NextFunction): void {
  const header = req.headers['x-workspace-id'];
  const workspaceId = (Array.isArray(header) ? header[0] : header)?.trim();
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

provisioningWizardRouter.use(requireWizardWorkspace);

function toProposal(analysis: AnalysedRole) {
  const tierInfo = getTierDisplayInfo(analysis.recommendedTier);
  return {
    analysis,
    proposal: {
      roleName: analysis.suggestedName,
      domainLabel: formatDomainLabel(analysis.domain),
      tools: analysis.requiredTools,
      skills: analysis.requiredSkills,
      channels: analysis.communicationChannels,
      tier: analysis.recommendedTier,
      tierLabel: tierInfo.label,
      slotLimit: tierInfo.slotLimit,
      slotRequirement: 1,
      confidenceScore: analysis.confidenceScore,
      complexity: analysis.complexity,
      roleTemplateId: analysis.roleTemplateId,
    },
  };
}

provisioningWizardRouter.post('/analyse', async (req: WizardRequest, res: Response) => {
  try {
    const description = String(req.body?.description ?? '').trim();
    if (!description) {
      res.status(400).json({ error: 'description is required' });
      return;
    }
    const analysis = await analyseRoleDescription(description);
    res.json(toProposal(analysis));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

provisioningWizardRouter.post('/propose', async (req: WizardRequest, res: Response) => {
  try {
    const description = String(req.body?.description ?? '').trim();
    if (!description) {
      res.status(400).json({ error: 'description is required' });
      return;
    }
    const analysis = await analyseRoleDescription(description);
    res.json(toProposal(analysis));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

provisioningWizardRouter.post('/build', async (req: WizardRequest, res: Response) => {
  try {
    const description = String(req.body?.description ?? req.body?.roleDescription ?? '').trim();
    const analysisInput = req.body?.analysis;
    const analysis = analysisInput && typeof analysisInput === 'object'
      ? {
          ...(await analyseRoleDescription(description || String(analysisInput.roleDescription ?? ''))),
          ...analysisInput,
          roleDescription: String(analysisInput.roleDescription ?? description).trim(),
        } as AnalysedRole
      : await analyseRoleDescription(description);

    if (!analysis.roleDescription) {
      res.status(400).json({ error: 'description is required' });
      return;
    }

    const result = await provisionFromRoleAnalysis({
      workspaceId: req.workspaceId!,
      analysis,
      roleName: typeof req.body?.roleName === 'string' ? req.body.roleName : undefined,
      roleDescription: typeof req.body?.roleDescription === 'string' ? req.body.roleDescription : undefined,
      channels: Array.isArray(req.body?.channels) ? req.body.channels.map(String) : undefined,
      successUrl: typeof req.body?.successUrl === 'string' ? req.body.successUrl : undefined,
      cancelUrl: typeof req.body?.cancelUrl === 'string' ? req.body.cancelUrl : undefined,
    });

    if (result.status === 'checkout_required') {
      res.status(402).json(result);
      return;
    }

    res.status(201).json({
      ...result,
      slotLimit: slotLimitForTier(result.tier),
      tierLabel: tierDisplayLabel(result.tier),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const slotMeta = (err as Error & { slotMeta?: Record<string, unknown> }).slotMeta;
    if (slotMeta) {
      res.status(402).json({ error: message, ...slotMeta });
      return;
    }
    res.status(400).json({ error: message });
  }
});

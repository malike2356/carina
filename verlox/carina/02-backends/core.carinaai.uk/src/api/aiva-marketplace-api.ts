import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { tierDisplayLabel, slotLimitForTier } from '../billing/aiva-tier.js';
import {
  getMarketplaceTemplate,
  listMarketplaceTemplates,
} from '../marketplace/template-registry.js';
import { provisionFromMarketplaceTemplate } from '../marketplace/one-click-provisioner.js';

export const aivaMarketplacePublicRouter: ExpressRouter = Router();
export const aivaMarketplaceRouter: ExpressRouter = Router();

function setPublicCors(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');
}

function toPublicSummary(template: ReturnType<typeof listMarketplaceTemplates>[number]) {
  return {
    templateId: template.templateId,
    name: template.name,
    icon: template.icon,
    tagline: template.tagline,
    tier: template.tier,
    tierLabel: tierDisplayLabel(template.tier),
    features: template.features,
    setupTimeSeconds: template.setupTimeSeconds,
    useCaseExample: template.useCaseExample,
  };
}

aivaMarketplacePublicRouter.options('/templates', (_req, res) => {
  setPublicCors(res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

aivaMarketplacePublicRouter.options('/templates/:id', (_req, res) => {
  setPublicCors(res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

aivaMarketplacePublicRouter.get('/templates', (_req, res) => {
  setPublicCors(res);
  const templates = listMarketplaceTemplates().map(toPublicSummary);
  res.json({ count: templates.length, templates });
});

aivaMarketplacePublicRouter.get('/templates/:id', (req, res) => {
  setPublicCors(res);
  const template = getMarketplaceTemplate(String(req.params.id));
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json({
    template: {
      ...template,
      tierLabel: tierDisplayLabel(template.tier),
      slotLimit: slotLimitForTier(template.tier),
    },
  });
});

type MarketplaceRequest = Request & { workspaceId?: string };

function requireMarketplaceWorkspace(req: MarketplaceRequest, res: Response, next: NextFunction): void {
  const header = req.headers['x-workspace-id'];
  const workspaceId = (Array.isArray(header) ? header[0] : header)?.trim();
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

aivaMarketplaceRouter.use(requireMarketplaceWorkspace);

aivaMarketplaceRouter.post('/provision', async (req: MarketplaceRequest, res: Response) => {
  try {
    const templateId = String(req.body?.templateId ?? '').trim();
    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }
    const result = await provisionFromMarketplaceTemplate({
      workspaceId: req.workspaceId!,
      templateId,
      successUrl: typeof req.body?.successUrl === 'string' ? req.body.successUrl : undefined,
      cancelUrl: typeof req.body?.cancelUrl === 'string' ? req.body.cancelUrl : undefined,
    });
    if (result.status === 'checkout_required') {
      res.status(402).json(result);
      return;
    }
    res.status(201).json(result);
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

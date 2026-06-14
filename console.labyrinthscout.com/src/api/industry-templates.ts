import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { applyPolicyPack } from '../security/policy-packs.js';
import {
  getIndustryTemplate,
  isIndustryTemplateId,
  listIndustryTemplates,
} from '../governance/industry-templates.js';
import {
  getActiveIndustryTemplateId,
  getActiveIndustryTemplateSummary,
  industryTemplateScopeKey,
  setActiveIndustryTemplate,
} from '../lib/industry-template-store.js';

export const industryTemplatesRouter: IRouter = Router();

industryTemplatesRouter.get('/', (_req: Request, res: Response): void => {
  res.json(listIndustryTemplates());
});

industryTemplatesRouter.get('/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : undefined;
    const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id : undefined;
    const active = await getActiveIndustryTemplateSummary(sessionId, instanceId);
    res.json(active);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[industry-templates] active lookup failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

industryTemplatesRouter.get('/:id', (req: Request, res: Response): void => {
  const id = String(req.params.id);
  if (!id || !isIndustryTemplateId(id)) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  res.json(getIndustryTemplate(id));
});

industryTemplatesRouter.post('/:id/apply', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!id || !isIndustryTemplateId(id)) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : undefined;
    const instanceId = typeof body.instance_id === 'string' ? body.instance_id : undefined;
    const appliedBy = typeof body.applied_by === 'string' && body.applied_by.trim()
      ? body.applied_by.trim()
      : 'operator';

    const template = getIndustryTemplate(id);
    await applyPolicyPack({
      packId: template.base_pack,
      sessionId,
      instanceId,
      appliedBy,
    });
    await setActiveIndustryTemplate(id, sessionId, instanceId);

    res.json({
      applied: true,
      template_id: id,
      base_pack_applied: template.base_pack,
      human_review_tools: template.human_review_required_for,
      scope_key: industryTemplateScopeKey(sessionId, instanceId),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[industry-templates] apply failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

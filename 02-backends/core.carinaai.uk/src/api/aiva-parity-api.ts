import type { NextFunction, Request, Response, Router as ExpressRouter } from 'express';
import { getWorker } from '../workers/worker-store.js';
import { logActivity } from '../workers/worker-store.js';
import { processAivaMessage } from '../workers/aiva-process-message.js';
import {
  ONBOARDING_PLANS,
  addCoManager,
  addProjectItem,
  completeOnboardingStep,
  createMemory,
  createProject,
  createVaultSecret,
  createWorkerSkill,
  deleteMemory,
  deleteToolGrant,
  deleteVaultSecret,
  getAivaProductTools,
  getOnboardingProgress,
  getWhatsAppNumber,
  listCoManagers,
  listMemories,
  listProjectItems,
  listProjects,
  listToolGrants,
  listVaultSecrets,
  listWorkerSkills,
  removeCoManager,
  runWorkerSkill,
  startOnboardingPlan,
  transferWorker,
  updateProject,
  upsertWhatsAppNumber,
} from '../workers/aiva-parity-store.js';
import { getCatalogTool } from '../workers/product-tools/catalog.js';
import { connectAndProbeTool, invokeProductTool } from '../workers/product-tools/invoke.js';
import { loadDepthFeatures } from '../workers/product-tools/features.js';
import { reloadProductToolsCatalog } from '../workers/product-tools/catalog.js';
import { reloadDepthFeatures } from '../workers/product-tools/features.js';
import {
  executeRealtimeToolCall,
  listRealtimeToolDefinitions,
} from '../workers/realtime-tools.js';

type AivaRequest = Request & { workspaceId?: string };

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

async function requireWorker(workspaceId: string, workerId: string) {
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) throw new Error('Worker not found');
  return worker;
}

export function mountAivaParityRoutes(
  aivaRouter: ExpressRouter,
  requireWorkspace: (req: AivaRequest, res: Response, next: NextFunction) => void,
): void {
  aivaRouter.get('/tools/catalog', requireWorkspace, (_req, res: Response) => {
    res.json({
      tools: getAivaProductTools(),
      features: loadDepthFeatures(),
      catalogPath: process.env.AIVA_PRODUCT_TOOLS_CATALOG_PATH ?? 'config/aiva/product-tools.catalog.json',
    });
  });

  aivaRouter.post('/tools/catalog/reload', requireWorkspace, (_req, res: Response) => {
    reloadProductToolsCatalog();
    reloadDepthFeatures();
    res.json({ ok: true, tools: getAivaProductTools().length, features: loadDepthFeatures() });
  });

  aivaRouter.get('/workers/:id/tools', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const grants = await listToolGrants(req.workspaceId!, workerId);
      let accountGrants: unknown[] = [];
      try {
        const { listWorkerAccountGrants, accountsFeatureEnabled } = await import('../workers/product-tools/accounts.js');
        if (accountsFeatureEnabled()) {
          accountGrants = await listWorkerAccountGrants(req.workspaceId!, workerId);
        }
      } catch {
        accountGrants = [];
      }
      res.json({ tools: getAivaProductTools(), grants, accountGrants });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/tools', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const toolSlug = String(req.body?.toolSlug ?? '').trim();
      const catalogTool = getCatalogTool(toolSlug);
      if (!catalogTool) {
        res.status(400).json({ error: 'Unknown tool slug' });
        return;
      }
      const scopes = Array.isArray(req.body?.scopes)
        ? (req.body.scopes as unknown[]).filter((item): item is string => typeof item === 'string')
        : catalogTool.scopes;
      const credentials = req.body?.credentials && typeof req.body.credentials === 'object'
        ? Object.fromEntries(
          Object.entries(req.body.credentials as Record<string, unknown>)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        )
        : undefined;
      const meta = req.body?.meta && typeof req.body.meta === 'object'
        ? Object.fromEntries(
          Object.entries(req.body.meta as Record<string, unknown>)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        )
        : undefined;

      const probed = await connectAndProbeTool({
        workspaceId: req.workspaceId!,
        workerId,
        slug: toolSlug,
        scopes,
        credentials,
        meta,
      });
      const grants = await listToolGrants(req.workspaceId!, workerId);
      res.status(probed.ok ? 201 : probed.needsOAuth ? 401 : 400).json({
        ok: probed.ok,
        grantStatus: probed.grantStatus,
        error: probed.error,
        needsOAuth: probed.needsOAuth,
        authUrl: probed.authUrl,
        probe: probed.data,
        grants,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/tools/:slug/invoke', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      const slug = routeParam(req.params.slug);
      await requireWorker(req.workspaceId!, workerId);
      const result = await invokeProductTool({
        workspaceId: req.workspaceId!,
        workerId,
        slug,
        action: String(req.body?.action ?? 'list'),
        input: (req.body?.input && typeof req.body.input === 'object')
          ? req.body.input as Record<string, unknown>
          : undefined,
      });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/workers/:id/realtime/tools', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const listed = await listRealtimeToolDefinitions(req.workspaceId!, workerId);
      res.json(listed);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/realtime/tools/execute', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const name = String(req.body?.name ?? '').trim();
      const args = (req.body?.arguments && typeof req.body.arguments === 'object')
        ? req.body.arguments as Record<string, unknown>
        : (req.body?.args && typeof req.body.args === 'object')
          ? req.body.args as Record<string, unknown>
          : {};
      const result = await executeRealtimeToolCall({
        workspaceId: req.workspaceId!,
        workerId,
        name,
        args,
      });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/voice/call', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const { placeOutboundVoiceCall, placeClickToCall } = await import('../channels/voice-pstn.js');
      const mode = String(req.body?.mode ?? 'aiva').trim().toLowerCase();
      if (mode === 'click_to_call' || mode === 'bridge' || mode === 'owner') {
        const { getWorkspaceContact } = await import('../email/workspace-contact.js');
        const contact = await getWorkspaceContact(req.workspaceId!);
        const ownerNumber = String(req.body?.ownerNumber ?? contact?.ownerPhone ?? '').trim();
        const result = await placeClickToCall({
          workspaceId: req.workspaceId!,
          workerId,
          ownerNumber,
          contactNumber: String(req.body?.to ?? req.body?.toNumber ?? ''),
          contactName: typeof req.body?.contactName === 'string' ? req.body.contactName : undefined,
        });
        res.status(result.ok ? 200 : 400).json(result);
        return;
      }
      const result = await placeOutboundVoiceCall({
        workspaceId: req.workspaceId!,
        workerId,
        toNumber: String(req.body?.to ?? req.body?.toNumber ?? ''),
      });
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.delete('/workers/:id/tools/:slug', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      const slug = routeParam(req.params.slug);
      await requireWorker(req.workspaceId!, workerId);
      await deleteToolGrant(req.workspaceId!, workerId, slug);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/workers/:id/vault', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const actingManager = typeof req.query.actingManagerWorkerId === 'string'
        ? req.query.actingManagerWorkerId
        : undefined;
      const { assertNotManagerWorkerVaultAccess } = await import('../workers/aiva-parity-store.js');
      await assertNotManagerWorkerVaultAccess(req.workspaceId!, actingManager, workerId);
      res.json({ secrets: await listVaultSecrets(req.workspaceId!, workerId) });
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/vault', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const secret = await createVaultSecret({
        workspaceId: req.workspaceId!,
        workerId,
        label: String(req.body?.label ?? ''),
        kind: typeof req.body?.kind === 'string' ? req.body.kind : 'api_key',
        value: String(req.body?.value ?? ''),
      });
      res.status(201).json({ secret });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.delete('/workers/:id/vault/:secretId', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      await deleteVaultSecret(req.workspaceId!, workerId, routeParam(req.params.secretId));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/workers/:id/skills', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      res.json({ skills: await listWorkerSkills(req.workspaceId!, workerId) });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/skills', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const skill = await createWorkerSkill({
        workspaceId: req.workspaceId!,
        workerId,
        title: String(req.body?.title ?? ''),
        description: typeof req.body?.description === 'string' ? req.body.description : '',
        steps: Array.isArray(req.body?.steps) ? req.body.steps : [],
        toolSlugs: Array.isArray(req.body?.toolSlugs)
          ? (req.body.toolSlugs as unknown[]).filter((item): item is string => typeof item === 'string')
          : [],
        triggerHints: Array.isArray(req.body?.triggerHints)
          ? (req.body.triggerHints as unknown[]).filter((item): item is string => typeof item === 'string')
          : [],
      });
      res.status(201).json({ skill });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/skills/:skillId/run', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const prepared = await runWorkerSkill(req.workspaceId!, workerId, routeParam(req.params.skillId));
      const reply = await processAivaMessage({
        workerId,
        workspaceId: req.workspaceId!,
        userMessage: prepared.prompt,
        channel: 'web',
        contactId: 'app',
        contactName: 'Workspace user',
        isWebPreviewSession: true,
      });
      await logActivity(workerId, {
        actionType: 'skill_used',
        summary: `Skill run: ${prepared.skill.title}`,
        outputText: reply.slice(0, 2000),
        channel: 'web',
        contactId: 'app',
        escalated: false,
      });
      const { autoLinkSkillRunToProject, proposeWorkerSkill } = await import('../workers/product-tools/depth-extras.js');
      const projectItem = await autoLinkSkillRunToProject({
        workspaceId: req.workspaceId!,
        workerId,
        skillId: prepared.skill.id,
        skillTitle: prepared.skill.title,
      }).catch(() => null);
      const proposal = await proposeWorkerSkill({
        workspaceId: req.workspaceId!,
        workerId,
        title: `Follow-up: ${prepared.skill.title}`,
        description: 'Auto-proposed after a successful skill run (toggle skills.autoPropose in depth-features.json).',
        steps: [{ type: 'skill_run', skillId: prepared.skill.id }],
        toolSlugs: prepared.skill.toolSlugs ?? [],
        sourceRef: `skill_run:${prepared.skill.id}`,
      }).catch(() => null);
      res.json({ skill: prepared.skill, reply, projectItem, proposal });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/projects', requireWorkspace, async (req: AivaRequest, res: Response) => {
    const workerId = typeof req.query.workerId === 'string' ? req.query.workerId : undefined;
    const orgId = typeof req.query.orgId === 'string'
      ? req.query.orgId
      : (typeof req.headers['x-aiva-org-id'] === 'string' ? req.headers['x-aiva-org-id'] : null);
    res.json({ projects: await listProjects(req.workspaceId!, workerId, orgId) });
  });

  aivaRouter.post('/projects', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const orgId = typeof req.body?.orgId === 'string'
        ? req.body.orgId
        : (typeof req.headers['x-aiva-org-id'] === 'string' ? req.headers['x-aiva-org-id'] : null);
      const project = await createProject({
        workspaceId: req.workspaceId!,
        workerId: typeof req.body?.workerId === 'string' ? req.body.workerId : null,
        orgId,
        title: String(req.body?.title ?? ''),
        description: typeof req.body?.description === 'string' ? req.body.description : '',
        status: typeof req.body?.status === 'string' ? req.body.status : 'planned',
      });
      res.status(201).json({ project });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.patch('/projects/:projectId', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const body = req.body ?? {};
      const patch: {
        status?: string;
        workerId?: string | null;
        title?: string;
        description?: string;
      } = {};
      if (typeof body.status === 'string') patch.status = body.status;
      if (typeof body.title === 'string') patch.title = body.title;
      if (typeof body.description === 'string') patch.description = body.description;
      if (body.workerId === null) patch.workerId = null;
      else if (typeof body.workerId === 'string') patch.workerId = body.workerId || null;

      const project = await updateProject(
        req.workspaceId!,
        routeParam(req.params.projectId),
        Object.keys(patch).length > 0 ? patch : { status: 'planned' },
      );
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json({ project });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/projects/:projectId/items', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const items = await listProjectItems(req.workspaceId!, routeParam(req.params.projectId));
      res.json({ items });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/projects/:projectId/items', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const item = await addProjectItem({
        workspaceId: req.workspaceId!,
        projectId: routeParam(req.params.projectId),
        itemType: String(req.body?.itemType ?? 'task'),
        itemRef: typeof req.body?.itemRef === 'string' ? req.body.itemRef : '',
        title: typeof req.body?.title === 'string' ? req.body.title : '',
      });
      res.status(201).json({ item });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/onboarding/plans', requireWorkspace, (_req, res: Response) => {
    res.json({ plans: ONBOARDING_PLANS });
  });

  aivaRouter.get('/workers/:id/onboarding', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      res.json({
        plans: ONBOARDING_PLANS,
        progress: await getOnboardingProgress(req.workspaceId!, workerId),
      });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/onboarding', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const progress = await startOnboardingPlan({
        workspaceId: req.workspaceId!,
        workerId,
        planId: String(req.body?.planId ?? ''),
      });
      res.status(201).json({ progress });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/onboarding/steps/:stepId/complete', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const progress = await completeOnboardingStep({
        workspaceId: req.workspaceId!,
        workerId,
        stepId: routeParam(req.params.stepId),
      });
      res.json({ progress });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/workers/:id/whatsapp-number', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      res.json({ assignment: await getWhatsAppNumber(req.workspaceId!, workerId) });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.put('/workers/:id/whatsapp-number', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const assignment = await upsertWhatsAppNumber({
        workspaceId: req.workspaceId!,
        workerId,
        path: String(req.body?.path ?? 'dedicated'),
        phoneE164: typeof req.body?.phoneE164 === 'string' ? req.body.phoneE164 : '',
        phoneNumberId: typeof req.body?.phoneNumberId === 'string' ? req.body.phoneNumberId : '',
        status: typeof req.body?.status === 'string' ? req.body.status : 'pending',
      });
      res.json({ assignment });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/workers/:id/comanagers', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      res.json({ comanagers: await listCoManagers(req.workspaceId!, workerId) });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/comanagers', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const managerWorkerId = typeof req.body?.managerWorkerId === 'string'
        ? req.body.managerWorkerId.trim()
        : '';
      const comanagers = await addCoManager({
        workspaceId: req.workspaceId!,
        workerId,
        email: managerWorkerId ? undefined : String(req.body?.email ?? ''),
        managerWorkerId: managerWorkerId || undefined,
        role: typeof req.body?.role === 'string'
          ? req.body.role
          : (managerWorkerId ? 'manager_worker' : 'co_manager'),
      });
      res.status(201).json({ comanagers });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.delete('/workers/:id/comanagers', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      await removeCoManager(req.workspaceId!, workerId, String(req.body?.email ?? req.query.email ?? ''));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/transfer', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const result = await transferWorker({
        workspaceId: req.workspaceId!,
        workerId,
        toEmail: String(req.body?.toEmail ?? ''),
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/workers/:id/memories', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      res.json({ memories: await listMemories(req.workspaceId!, workerId) });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/memories', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const memory = await createMemory({
        workspaceId: req.workspaceId!,
        workerId,
        content: String(req.body?.content ?? ''),
        kind: typeof req.body?.kind === 'string' ? req.body.kind : 'preference',
        pinned: Boolean(req.body?.pinned ?? true),
      });
      res.status(201).json({ memory });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.delete('/workers/:id/memories/:memoryId', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      await deleteMemory(req.workspaceId!, workerId, routeParam(req.params.memoryId));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/features', requireWorkspace, (_req, res: Response) => {
    res.json({ features: loadDepthFeatures() });
  });

  aivaRouter.get('/canvas/workers', requireWorkspace, async (req: AivaRequest, res: Response) => {
    const features = loadDepthFeatures();
    if (!features.orgs.canvasEnabled) {
      res.status(404).json({ error: 'Canvas disabled in depth-features config' });
      return;
    }
    const { listCanvasWorkers } = await import('../workers/product-tools/depth-extras.js');
    const orgId = typeof req.query.orgId === 'string'
      ? req.query.orgId
      : (typeof req.headers['x-aiva-org-id'] === 'string' ? req.headers['x-aiva-org-id'] : null);
    res.json({ workers: await listCanvasWorkers(req.workspaceId!, orgId) });
  });

  aivaRouter.get('/conversations/search', requireWorkspace, async (req: AivaRequest, res: Response) => {
    const { searchConversationBodies } = await import('../workers/product-tools/depth-extras.js');
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const workerId = typeof req.query.workerId === 'string' ? req.query.workerId : undefined;
    res.json(await searchConversationBodies({
      workspaceId: req.workspaceId!,
      query: q,
      workerId,
    }));
  });

  aivaRouter.put('/workspace/org-link', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const features = loadDepthFeatures();
      if (!features.orgs.enabled) {
        res.status(404).json({ error: 'Orgs feature disabled in depth-features config' });
        return;
      }
      const { linkWorkspaceOrg, getWorkspaceOrgLink } = await import('../workers/product-tools/depth-extras.js');
      const orgId = String(req.body?.orgId ?? '').trim();
      if (!orgId) {
        res.status(400).json({ error: 'orgId required' });
        return;
      }
      await linkWorkspaceOrg(req.workspaceId!, orgId);
      res.json({ orgId: await getWorkspaceOrgLink(req.workspaceId!) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/workspace/org-link', requireWorkspace, async (req: AivaRequest, res: Response) => {
    const { getWorkspaceOrgLink } = await import('../workers/product-tools/depth-extras.js');
    res.json({ orgId: await getWorkspaceOrgLink(req.workspaceId!) });
  });

  aivaRouter.get('/workspace/org-members', requireWorkspace, async (req: AivaRequest, res: Response) => {
    const { listOrgMembersForWorkspace } = await import('../workers/product-tools/depth-extras.js');
    res.json(await listOrgMembersForWorkspace(req.workspaceId!));
  });

  aivaRouter.post('/workspace/org-invites', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { inviteOrgSeat } = await import('../workers/product-tools/depth-extras.js');
      const invitedBy = typeof req.body?.invitedBy === 'string' && req.body.invitedBy.trim()
        ? req.body.invitedBy.trim()
        : (typeof (req as AivaRequest & { userId?: string }).userId === 'string'
          ? String((req as AivaRequest & { userId?: string }).userId)
          : 'workspace');
      const result = await inviteOrgSeat({
        workspaceId: req.workspaceId!,
        email: String(req.body?.email ?? ''),
        role: typeof req.body?.role === 'string' ? req.body.role : 'operator',
        invitedBy,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/workers/:id/skill-proposals', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const { listSkillProposals } = await import('../workers/product-tools/depth-extras.js');
      res.json({ proposals: await listSkillProposals(req.workspaceId!, workerId) });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/skill-proposals', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const { proposeWorkerSkill } = await import('../workers/product-tools/depth-extras.js');
      const result = await proposeWorkerSkill({
        workspaceId: req.workspaceId!,
        workerId,
        title: String(req.body?.title ?? ''),
        description: typeof req.body?.description === 'string' ? req.body.description : '',
        steps: Array.isArray(req.body?.steps) ? req.body.steps : [],
        toolSlugs: Array.isArray(req.body?.toolSlugs)
          ? (req.body.toolSlugs as unknown[]).filter((item): item is string => typeof item === 'string')
          : [],
        sourceRef: typeof req.body?.sourceRef === 'string' ? req.body.sourceRef : '',
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/workers/:id/skill-proposals/:proposalId/confirm', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const { confirmSkillProposal } = await import('../workers/product-tools/depth-extras.js');
      const skill = await confirmSkillProposal(req.workspaceId!, workerId, routeParam(req.params.proposalId));
      res.json({ skill });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/workers/:id/draft', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const { getComposerDraft } = await import('../workers/product-tools/depth-extras.js');
      const threadKey = typeof req.query.threadKey === 'string' ? req.query.threadKey : 'default';
      res.json(await getComposerDraft(req.workspaceId!, workerId, threadKey));
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.put('/workers/:id/draft', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const workerId = routeParam(req.params.id);
      await requireWorker(req.workspaceId!, workerId);
      const { saveComposerDraft } = await import('../workers/product-tools/depth-extras.js');
      const draft = await saveComposerDraft({
        workspaceId: req.workspaceId!,
        workerId,
        threadKey: typeof req.body?.threadKey === 'string' ? req.body.threadKey : 'default',
        draftText: String(req.body?.draftText ?? ''),
      });
      res.json(draft);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/orgs', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { listOrgsForSwitcher } = await import('../workers/product-tools/depth-extras.js');
      res.json(await listOrgsForSwitcher(req.workspaceId!));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/orgs/active', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { setActiveOrgForWorkspace } = await import('../workers/product-tools/depth-extras.js');
      res.json(await setActiveOrgForWorkspace(req.workspaceId!, String(req.body?.orgId ?? '')));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/tool-accounts', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { listToolAccounts } = await import('../workers/product-tools/accounts.js');
      const toolSlug = typeof req.query.toolSlug === 'string' ? req.query.toolSlug : undefined;
      const orgId = typeof req.query.orgId === 'string'
        ? req.query.orgId
        : (typeof req.headers['x-aiva-org-id'] === 'string' ? req.headers['x-aiva-org-id'] : null);
      res.json({ accounts: await listToolAccounts(req.workspaceId!, toolSlug, orgId) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/tool-accounts', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { createAndProbeToolAccount } = await import('../workers/product-tools/accounts.js');
      const rawCreds = (req.body?.credentials && typeof req.body.credentials === 'object')
        ? req.body.credentials as Record<string, unknown>
        : {};
      const credentials: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawCreds)) {
        if (typeof value === 'string') credentials[key] = value;
      }
      const result = await createAndProbeToolAccount({
        workspaceId: req.workspaceId!,
        toolSlug: String(req.body?.toolSlug ?? ''),
        label: typeof req.body?.label === 'string' ? req.body.label : undefined,
        credentials,
        orgId: typeof req.body?.orgId === 'string'
          ? req.body.orgId
          : (typeof req.headers['x-aiva-org-id'] === 'string' ? req.headers['x-aiva-org-id'] : null),
        meta: (req.body?.meta && typeof req.body.meta === 'object')
          ? req.body.meta as Record<string, unknown>
          : undefined,
      });
      res.status(result.ok ? 201 : 400).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/tool-accounts/:id/probe', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { probeToolAccount } = await import('../workers/product-tools/accounts.js');
      res.json(await probeToolAccount(req.workspaceId!, routeParam(req.params.id)));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/tool-accounts/:id/grant', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { grantToolAccountToWorker } = await import('../workers/product-tools/accounts.js');
      const grants = await grantToolAccountToWorker({
        workspaceId: req.workspaceId!,
        accountId: routeParam(req.params.id),
        workerId: String(req.body?.workerId ?? ''),
        scopes: Array.isArray(req.body?.scopes)
          ? (req.body.scopes as unknown[]).filter((item): item is string => typeof item === 'string')
          : undefined,
      });
      res.status(201).json({ grants });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.delete('/tool-accounts/:id/grant/:workerId', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { revokeToolAccountFromWorker } = await import('../workers/product-tools/accounts.js');
      await revokeToolAccountFromWorker(req.workspaceId!, routeParam(req.params.workerId), routeParam(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.delete('/tool-accounts/:id', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { deleteToolAccount } = await import('../workers/product-tools/accounts.js');
      await deleteToolAccount(req.workspaceId!, routeParam(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/browser/assists', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { listOpenBrowserAssists } = await import('../workers/product-tools/browser-assists.js');
      const workerId = typeof req.query.workerId === 'string' ? req.query.workerId : undefined;
      res.json({ assists: await listOpenBrowserAssists(req.workspaceId!, workerId) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/browser/assists/:id/resume', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { resumeBrowserAssist } = await import('../workers/product-tools/browser-assists.js');
      res.json({ assist: await resumeBrowserAssist(req.workspaceId!, routeParam(req.params.id)) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.post('/browser/assists/:id/cancel', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { cancelBrowserAssist } = await import('../workers/product-tools/browser-assists.js');
      await cancelBrowserAssist(req.workspaceId!, routeParam(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  aivaRouter.get('/human-assist/requests', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { listHumanAssistRequests } = await import('../workers/human-assist-requests.js');
      res.json({ requests: await listHumanAssistRequests(req.workspaceId!) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: 'error' });
    }
  });

  aivaRouter.post('/human-assist/requests', requireWorkspace, async (req: AivaRequest, res: Response) => {
    try {
      const { createHumanAssistRequest } = await import('../workers/human-assist-requests.js');
      const result = await createHumanAssistRequest({
        workspaceId: req.workspaceId!,
        reason: String(req.body?.reason ?? ''),
        urgency: typeof req.body?.urgency === 'string' ? req.body.urgency : 'normal',
        workerId: typeof req.body?.workerId === 'string' ? req.body.workerId : null,
        channel: typeof req.body?.channel === 'string' ? req.body.channel : '',
        threadRef: typeof req.body?.threadRef === 'string' ? req.body.threadRef : '',
      });
      if (!result.ok) {
        res.status(result.code === 'capacity' ? 429 : 400).json(result);
        return;
      }
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err), code: 'error' });
    }
  });
}

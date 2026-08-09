import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { pool } from '../memory/db.js';
import {
  createAutomation,
  createWorker,
  deleteAutomation,
  dismissWorker,
  getAutomation,
  getWorker,
  getWorkerById,
  getWorkerAnalytics,
  getWorkerOverviewMetrics,
  listActivity,
  listOutboundCommunications,
  listAudit,
  listAutomations,
  listOpenEscalations,
  dismissOpenEscalation,
  listWorkers,
  pauseWorker,
  resumeWorker,
  removeWorkerChannel,
  toggleAutomation,
  updateWorker,
} from '../workers/worker-store.js';
import {
  listWorkerChannelDetails,
  readChannelCredentials,
  setChannelEnabled,
} from '../channels/channel-store.js';
import { isSocialChannel } from '../channels/social-channel-utils.js';
import { registerChannel, unregisterChannel } from '../channels/worker-registry.js';
import { buildCustomPersonaPrompt, buildPersonaPrompt } from '../workers/persona-builder.js';
import { getRoleTemplate, ROLE_TEMPLATES } from '../workers/role-templates.js';
import { parseScheduleText } from '../workers/schedule-parser.js';
import {
  isAiWorkersEnabled,
} from '../workers/workspace-message-handler.js';
import { isPropreneurBridgeEnabled } from '../workers/aiva-feature-flags.js';
import {
  clearPropreneurBinding,
  resolvePropreneurBinding,
  validateAndSetPropreneurBinding,
} from '../workers/worker-bridge-store.js';
import {
  createPropreneurConnectToken,
  registerPropreneurOAuthRoutes,
} from '../bridges/propreneur-oauth-bridge.js';
import { credentialsConfigured } from '../channels/credential-store.js';
import {
  registerAutomationJob,
  unregisterAutomationJob,
} from '../workers/workspace-automation-scheduler.js';
import {
  getBillingStatus,
  getSubscription,
  getSubscriptionStatus,
  provisionTrial,
} from '../workers/aiva-subscription-store.js';
import { listAivaInvoices } from '../billing/aiva-billing-store.js';
import {
  sendWelcomeEmail,
} from '../email/email-triggers.js';
import {
  upsertWorkspaceContact,
  aivaAppUrl,
  getWorkspaceContact,
  updateWorkspaceOwnerProfile,
  serializeWorkspaceProfile,
} from '../email/workspace-contact.js';
import { eraseWorkspaceData, streamWorkspaceExportZip } from '../workers/workspace-gdpr.js';
import { maskIdentifier } from '../channels/mask-identifier.js';
import {
  appendKnowledgeToPersona,
  extractDocumentText,
  FAQ_PAIR_CHAR_LIMIT,
  getKnowledgeCharTotal,
  KNOWLEDGE_CHAR_LIMIT,
  listKnowledgeSummaries,
  stripKnowledgeFromPersona,
  truncateDocumentText,
} from '../workers/knowledge-base.js';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { rateLimitMiddleware } from '../security/redis-rate-limit.js';
import { appendSecurityAudit } from '../security/security-audit.js';
import { strictWorkspaceCheckEnabled, workspaceExists } from '../hosted/workspace-scoped-query.js';
import { requireBusinessPlan, requireTeamPlan } from '../billing/aiva-plan-middleware.js';
import {
  channelLimitForTier,
  countConnectedChannels,
  resolveWorkspacePlanTier,
} from '../billing/aiva-plan-gates.js';
import { toolsetsForAivaTier } from '../workers/workspace-tier-toolsets.js';
import { resolveToolset } from '../tools/toolset.js';
import {
  createAivaCheckoutSession,
  createAivaPortalSession,
} from '../billing/workspace-stripe-checkout.js';
import { createAivaPrepaidCheckoutSession } from '../billing/aiva-prepaid-checkout.js';
import { isAivaPrepaidPackId } from '../billing/aiva-prepaid-packs.js';
import { loadAivaPricingPlans } from '../billing/aiva-pricing.js';
import { UNLIMITED_SLOT_DB_VALUE } from '../billing/workspace-tier.js';
import {
  getDowngradeConflictFields,
  resolveDowngradeConflict,
} from '../billing/aiva-downgrade.js';
import {
  parseChannelBindings,
  provisionWorkerChannels,
  sendHireOnboardingMessages,
} from '../workers/provision-worker-channels.js';
import {
  defaultPlaybookIdForRoleTemplate,
  getAivaPlaybookTemplate,
  listAivaPlaybookTemplates,
} from '../workers/aiva-playbook-templates.js';
import { provisionWorkerPlaybook } from '../workers/provision-worker-playbook.js';
import { startWorkerPlaybookRun } from '../workers/playbook-run-client.js';
import { workerPlaybookRouter } from './worker-playbook-api.js';
import { aivaMarketplaceRouter } from './aiva-marketplace-api.js';
import { provisioningWizardRouter } from './provisioning-wizard-api.js';
import { mountAivaParityRoutes } from './aiva-parity-api.js';
import {
  assignEmployeeTask,
  createEmployeeConversation,
  deleteEmployeeConversation,
  getEmployeeProfile,
  listEmployeeConversations,
  listEmployeeDirectory,
  listEmployeeEvents,
  listEmployeeTasks,
  listEmployeeThreadMessages,
  renameEmployeeConversation,
  sendEmployeeMessage,
  updateEmployeeTask,
} from '../aiva/employee-comms.js';
import {
  approveAivaLearningItem,
  listAivaLearning,
  removeAivaLearningItem,
  runAivaDailyLearningReview,
} from '../memory/aiva/learning-loop.js';
import {
  getLatestWhatsAppWebPairing,
  revokeWhatsAppWebPairing,
  startWhatsAppWebPairing,
  whatsappWebOperationalWarnings,
} from '../channels/whatsapp-web-pairing.js';

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  slack: 'Slack',
  telegram: 'Telegram',
  web: 'Web chat',
  sms: 'SMS',
  discord: 'Discord',
  teams: 'Microsoft Teams',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  messenger: 'Facebook Messenger',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
};

const ALL_CHANNEL_TYPES = [
  'whatsapp',
  'email',
  'slack',
  'telegram',
  'web',
  'sms',
  'voice',
  'discord',
  'teams',
  'linkedin',
  'instagram',
  'messenger',
  'twitter',
  'tiktok',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ChannelConnectionStatus =
  | 'disconnected'
  | 'oauth_pending'
  | 'configured'
  | 'connected'
  | 'token_expired';

function resolveChannelConnectionStatus(
  type: string,
  workerChannels: string[],
  row: Awaited<ReturnType<typeof listWorkerChannelDetails>>[number] | undefined,
): ChannelConnectionStatus {
  const hired = workerChannels.includes(type);
  if (type === 'web') {
    return hired ? 'connected' : 'disconnected';
  }
  if (!row) {
    return hired ? 'oauth_pending' : 'disconnected';
  }
  const hasCredentials = Boolean(row.credentials.encrypted);
  if (!hasCredentials || row.identifier === 'pending') {
    return 'oauth_pending';
  }
  if (isSocialChannel(type)) {
    const creds = readChannelCredentials(row);
    const expiresRaw = creds.token_expires_at?.trim() || creds.expires_at?.trim();
    if (expiresRaw) {
      const expires = new Date(expiresRaw);
      if (!Number.isNaN(expires.getTime()) && expires < new Date()) {
        return 'token_expired';
      }
    }
  }
  return row.verified ? 'connected' : 'configured';
}

async function assertCanHireWorker(workspaceId: string): Promise<void> {
  let status = await getSubscriptionStatus(workspaceId);
  if (Number(status.slotLimit) === 0 && Number(status.aivasUsed) === 0) {
    await provisionTrial(workspaceId);
    status = await getSubscriptionStatus(workspaceId);
  }
  if (Number(status.slotLimit) >= UNLIMITED_SLOT_DB_VALUE) {
    return;
  }
  if (status.status === 'suspended') {
    throw new Error('Trial expired. Upgrade your plan to hire more Aivas.');
  }
  // pending_channel: trial not started yet; hiring is allowed so the user can connect their first channel.
  if (status.status === 'pending_channel') return;
  if (Number(status.slotLimit) > 0 && Number(status.aivasUsed) >= Number(status.slotLimit)) {
    const err = new Error('Aiva slot limit reached for your plan.');
    (err as Error & { slotMeta?: Record<string, unknown> }).slotMeta = {
      code: 'aiva_slot_limit_reached',
      currentTier: status.planTier,
      slotLimit: status.slotLimit,
      aivasUsed: status.aivasUsed,
      upgradeUrl: '/billing/aiva',
    };
    throw err;
  }
}

function billingErrorStatus(message: string): number {
  if (
    message.includes('not configured')
    || message.includes('Stripe price not configured')
    || message.includes('billing is disabled')
  ) {
    return 503;
  }
  return 500;
}

export const aivaRouter: ExpressRouter = Router();
registerPropreneurOAuthRoutes(aivaRouter);
aivaRouter.use(requireCloudProxy);

type AivaRequest = Request & { workspaceId?: string };

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function resolveWorkspaceId(req: AivaRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

/**
 * Tenant isolation gate for every Aiva workspace route. The caller must
 * already be a trusted proxy (requireCloudProxy, applied on aivaRouter
 * below), which is where end-user session ownership of the workspace is
 * verified before the request reaches core; this middleware then validates
 * the workspace identifier itself and, optionally, that it exists.
 *
 * Exported as enforceWorkspaceAccess to make this the canonical name other
 * Aiva routers should adopt; see docs/production-hardening.md for the
 * audit of the ~15 near-duplicate requireWorkspace implementations found
 * across this codebase.
 */
async function enforceWorkspaceAccess(req: AivaRequest, res: Response, next: NextFunction): Promise<void> {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'AI workers are disabled' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    appendSecurityAudit({
      category: 'tenant_isolation',
      action: 'workspace_id_missing',
      detail: `${req.method} ${req.path} rejected: no workspaceId supplied`,
    });
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header or body)' });
    return;
  }
  if (!UUID_RE.test(workspaceId)) {
    appendSecurityAudit({
      category: 'tenant_isolation',
      action: 'workspace_id_invalid',
      detail: `${req.method} ${req.path} rejected: malformed workspaceId`,
    });
    res.status(400).json({ error: 'Invalid workspaceId' });
    return;
  }
  if (strictWorkspaceCheckEnabled() && !(await workspaceExists(workspaceId))) {
    appendSecurityAudit({
      category: 'tenant_isolation',
      action: 'workspace_not_found',
      detail: `${req.method} ${req.path} rejected: workspaceId does not exist`,
      metadata: { workspaceId },
    });
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

const requireWorkspace = enforceWorkspaceAccess;

aivaRouter.use('/workers/:id', requireWorkspace, workerPlaybookRouter);
aivaRouter.use('/marketplace', requireWorkspace, aivaMarketplaceRouter);
aivaRouter.use('/provision', requireWorkspace, provisioningWizardRouter);
mountAivaParityRoutes(aivaRouter, requireWorkspace);

aivaRouter.post('/workers', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    await assertCanHireWorker(workspaceId);

    // Prefer custom Aiva name over template/role label when both are sent.
    const roleName = String(req.body?.name ?? req.body?.roleName ?? '').trim();
    const roleDescription = String(req.body?.roleDescription ?? '').trim();
    const templateId = req.body?.templateId ? String(req.body.templateId) : null;
    const channels = Array.isArray(req.body?.channels)
      ? req.body.channels.map(String)
      : [];
    const language = req.body?.language ? String(req.body.language) : 'en-GB';

    if (!roleName || !roleDescription) {
      res.status(400).json({ error: 'name (or roleName) and roleDescription are required' });
      return;
    }

    let personaPrompt: string;
    let skillPacks: string[];
    let defaultChannels = channels;

    if (templateId) {
      const template = getRoleTemplate(templateId);
      if (!template) {
        res.status(400).json({ error: `Unknown template: ${templateId}` });
        return;
      }
      personaPrompt = buildPersonaPrompt(roleName, template, roleDescription);
      skillPacks = template.skillPacks;
      if (defaultChannels.length === 0) defaultChannels = template.defaultChannels;
    } else {
      personaPrompt = buildCustomPersonaPrompt(roleName, roleDescription);
      skillPacks = Array.isArray(req.body?.skillPacks)
        ? req.body.skillPacks.map(String)
        : ['communication'];
    }

    const worker = await createWorker(workspaceId, {
      name: roleName,
      roleDescription,
      templateId,
      personaPrompt,
      skillPacks,
      channels: defaultChannels,
      language,
      orgId: typeof req.body?.orgId === 'string' && req.body.orgId.trim()
        ? req.body.orgId.trim()
        : (typeof req.headers['x-aiva-org-id'] === 'string' ? req.headers['x-aiva-org-id'] : null),
    });

    const explicitPlaybookId = req.body?.playbookId ? String(req.body.playbookId).trim() : '';
    const usePlaybookTemplate = req.body?.usePlaybookTemplate !== false;
    const resolvedPlaybookId =
      explicitPlaybookId
      || (usePlaybookTemplate ? defaultPlaybookIdForRoleTemplate(templateId) : null);
    if (resolvedPlaybookId) {
      const template = getAivaPlaybookTemplate(resolvedPlaybookId);
      if (!template && !explicitPlaybookId) {
        res.status(400).json({ error: `Unknown playbook template: ${resolvedPlaybookId}` });
        return;
      }
      const variables =
        req.body?.playbookVariables && typeof req.body.playbookVariables === 'object'
          ? req.body.playbookVariables as Record<string, string | number | boolean>
          : undefined;
      await provisionWorkerPlaybook(workspaceId, worker.id, {
        playbookId: resolvedPlaybookId,
        variables,
      });
      if (req.body?.bootstrapPlaybookRun === true) {
        const refreshed = await getWorker(workspaceId, worker.id);
        const playbook = refreshed?.workerConfig?.playbook;
        if (playbook?.playbookId) {
          void startWorkerPlaybookRun({
            workerId: worker.id,
            workspaceId,
            playbook,
            trigger: 'hire',
          }).catch((err) => {
            console.warn('[aiva-api] hire bootstrap playbook run failed:', err);
          });
        }
      }
    }

    const channelBindings = parseChannelBindings(req.body?.channelBindings);
    const channelRows = await provisionWorkerChannels(
      worker,
      workspaceId,
      defaultChannels,
      channelBindings,
    );
    void sendHireOnboardingMessages(worker, channelRows, channelBindings).catch((err) => {
      console.warn('[aiva-api] hire onboarding messages failed:', err);
    });

    res.status(201).json({ worker: await getWorker(workspaceId, worker.id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const slotMeta = (err as Error & { slotMeta?: Record<string, unknown> }).slotMeta;
    if (slotMeta || msg.includes('slot limit')) {
      const status = slotMeta ?? await getSubscriptionStatus(req.workspaceId!);
      const tier = String((status as Record<string, unknown>).planTier ?? 'trial');
      const limit = Number((status as Record<string, unknown>).slotLimit ?? 0);
      const used = Number((status as Record<string, unknown>).aivasUsed ?? 0);
      res.status(402).json({
        error: 'aiva_slot_limit_reached',
        message: `You have reached your Aiva limit on ${tier}. Upgrade to hire more Aivas.`,
        code: 'aiva_slot_limit_reached',
        upgradeUrl: '/billing/aiva',
        currentTier: tier,
        slotLimit: limit,
        aivasUsed: used,
      });
      return;
    }
    const status = msg.includes('Trial expired') || msg.includes('suspended') ? 403 : 500;
    res.status(status).json({ error: msg });
  }
});

aivaRouter.get('/workers', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const orgId = typeof req.query.orgId === 'string'
    ? req.query.orgId
    : (typeof req.headers['x-aiva-org-id'] === 'string' ? req.headers['x-aiva-org-id'] : null);
  const { loadDepthFeatures } = await import('../workers/product-tools/features.js');
  const features = loadDepthFeatures();
  const scoped = (features.orgs.strictScoping || features.orgs.switcherEnabled) ? orgId : null;
  const workers = await listWorkers(req.workspaceId!, scoped);
  res.json({ workers });
});

aivaRouter.get('/employees', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const employees = await listEmployeeDirectory(req.workspaceId!);
  res.json({ employees, workers: employees });
});

aivaRouter.get('/employees/:id', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const employee = await getEmployeeProfile(req.workspaceId!, routeParam(req.params.id));
  if (!employee) {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }
  res.json({ employee, worker: employee });
});

async function handleEmployeeThread(req: AivaRequest, res: Response): Promise<void> {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const contactId = typeof req.query.contactId === 'string' ? req.query.contactId : 'app';
  const limit = parseInt(String(req.query.limit ?? '50'), 10) || 50;

  // Keep GET fast. Owner auto-sync binding/hydrate runs on message send and
  // channel-sync, not on every thread poll (slow hydrate caused proxy HTML errors).
  try {
    const { resolveAivaSessionWithOwnerAuto, isWebOwnerContactId } = await import(
      '../memory/aiva/owner-auto-sync.js'
    );
    if (isWebOwnerContactId(contactId)) {
      void resolveAivaSessionWithOwnerAuto({
        workspaceId,
        workerId,
        channel: 'web',
        contactId,
      }).catch(() => undefined);
    }
  } catch {
    /* ignore bind failures; still return the visible thread */
  }

  const result = await listEmployeeThreadMessages(workspaceId, workerId, {
    contactId,
    limit,
  });
  res.json(result);
}

async function handleEmployeeMessage(req: AivaRequest, res: Response): Promise<void> {
  try {
    const workerId = routeParam(req.params.id);
    const content = String(req.body?.content ?? req.body?.message ?? '').trim();
    const rawAttachments: unknown[] = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
    const attachments: Array<{ absolutePath: string; filename: string }> = [];
    for (const item of rawAttachments) {
      if (!item || typeof item !== 'object') continue;
      const row = item as { absolutePath?: unknown; filename?: unknown; path?: unknown; name?: unknown };
      const absolutePath = String(row.absolutePath ?? row.path ?? '').trim();
      const filename = String(row.filename ?? row.name ?? '').trim();
      if (!absolutePath || !filename) continue;
      attachments.push({ absolutePath, filename });
    }
    const result = await sendEmployeeMessage({
      workspaceId: req.workspaceId!,
      workerId,
      content,
      contactId: typeof req.body?.contactId === 'string' ? req.body.contactId : 'app',
      contactName: typeof req.body?.contactName === 'string' ? req.body.contactName : 'Workspace user',
      apiTokenId: typeof req.body?.apiTokenId === 'string' ? req.body.apiTokenId : undefined,
      attachments,
    });
    res.status(201).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('not found')
      ? 404
      : /dismissed|paused/i.test(msg)
        ? 409
        : 400;
    res.status(status).json({ error: msg });
  }
}

async function handleChatAttachmentUpload(req: AivaRequest, res: Response): Promise<void> {
  try {
    const workerId = routeParam(req.params.id);
    const existing = await getWorker(req.workspaceId!, workerId);
    if (!existing) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    const { saveAivaChatAttachment } = await import('../aiva/chat-attachments.js');
    const saved = await saveAivaChatAttachment({
      workspaceId: req.workspaceId!,
      workerId,
      filename: String(req.body?.filename ?? 'upload.bin'),
      dataBase64: String(req.body?.data ?? ''),
    });
    res.status(201).json({
      absolutePath: saved.absolutePath,
      filename: saved.filename,
      bytes: saved.bytes,
      extension: saved.extension,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleListEmployeeConversations(req: AivaRequest, res: Response): Promise<void> {
  const conversations = await listEmployeeConversations(
    req.workspaceId!,
    routeParam(req.params.id),
  );
  res.json({ conversations });
}

async function handleCreateEmployeeConversation(req: AivaRequest, res: Response): Promise<void> {
  try {
    const conversation = await createEmployeeConversation(
      req.workspaceId!,
      routeParam(req.params.id),
    );
    res.status(201).json({ conversation });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('not found') ? 404 : 400).json({ error: msg });
  }
}

async function handleRenameEmployeeConversation(req: AivaRequest, res: Response): Promise<void> {
  try {
    const conversation = await renameEmployeeConversation(
      req.workspaceId!,
      routeParam(req.params.id),
      routeParam(req.params.conversationId),
      String(req.body?.title ?? ''),
    );
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ conversation });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleDeleteEmployeeConversation(req: AivaRequest, res: Response): Promise<void> {
  const deleted = await deleteEmployeeConversation(
    req.workspaceId!,
    routeParam(req.params.id),
    routeParam(req.params.conversationId),
  );
  if (!deleted) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.status(204).end();
}

async function handleListEmployeeTasks(req: AivaRequest, res: Response): Promise<void> {
  const tasks = await listEmployeeTasks(req.workspaceId!, routeParam(req.params.id), {
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    limit: parseInt(String(req.query.limit ?? '50'), 10) || 50,
  });
  res.json({ tasks });
}

async function handleAssignEmployeeTask(req: AivaRequest, res: Response): Promise<void> {
  try {
    const task = await assignEmployeeTask({
      workspaceId: req.workspaceId!,
      workerId: routeParam(req.params.id),
      title: String(req.body?.title ?? '').trim(),
      instructions: String(req.body?.instructions ?? req.body?.description ?? '').trim(),
      expectedOutput: typeof req.body?.expectedOutput === 'string' ? req.body.expectedOutput : null,
      priority: req.body?.priority,
      dueAt: typeof req.body?.dueAt === 'string' && req.body.dueAt ? req.body.dueAt : null,
      attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
      createdBy: typeof req.body?.createdBy === 'string' ? req.body.createdBy : 'app',
    });
    res.status(201).json({ task });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('not found') ? 404 : 400).json({ error: msg });
  }
}

async function handleUpdateEmployeeTask(req: AivaRequest, res: Response): Promise<void> {
  const task = await updateEmployeeTask({
    workspaceId: req.workspaceId!,
    workerId: routeParam(req.params.id),
    taskId: routeParam(req.params.taskId),
    status: req.body?.status,
    completedWork: typeof req.body?.completedWork === 'string' ? req.body.completedWork : null,
  });
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ task });
}

async function handleListEmployeeEvents(req: AivaRequest, res: Response): Promise<void> {
  const events = await listEmployeeEvents(req.workspaceId!, routeParam(req.params.id), {
    limit: parseInt(String(req.query.limit ?? '50'), 10) || 50,
  });
  res.json({ events });
}

const aivaChatLimiter = rateLimitMiddleware('ai_api', {
  keyFn: (req) => `workspace:${(req as AivaRequest).workspaceId ?? req.ip ?? 'unknown'}`,
});

aivaRouter.get('/employees/:id/thread', requireWorkspace, handleEmployeeThread);
aivaRouter.post('/employees/:id/messages', requireWorkspace, aivaChatLimiter, handleEmployeeMessage);
aivaRouter.get('/employees/:id/tasks', requireWorkspace, handleListEmployeeTasks);
aivaRouter.post('/employees/:id/tasks', requireWorkspace, handleAssignEmployeeTask);
aivaRouter.patch('/employees/:id/tasks/:taskId', requireWorkspace, handleUpdateEmployeeTask);
aivaRouter.get('/employees/:id/events', requireWorkspace, handleListEmployeeEvents);

aivaRouter.get('/workers/:id/direct-thread', requireWorkspace, handleEmployeeThread);
aivaRouter.post('/workers/:id/direct-messages', requireWorkspace, aivaChatLimiter, handleEmployeeMessage);
aivaRouter.post('/workers/:id/chat-attachments', requireWorkspace, aivaChatLimiter, handleChatAttachmentUpload);
aivaRouter.get('/workers/:id/direct-conversations', requireWorkspace, handleListEmployeeConversations);
aivaRouter.post('/workers/:id/direct-conversations', requireWorkspace, handleCreateEmployeeConversation);
aivaRouter.patch('/workers/:id/direct-conversations/:conversationId', requireWorkspace, handleRenameEmployeeConversation);
aivaRouter.delete('/workers/:id/direct-conversations/:conversationId', requireWorkspace, handleDeleteEmployeeConversation);
aivaRouter.get('/workers/:id/direct-tasks', requireWorkspace, handleListEmployeeTasks);
aivaRouter.post('/workers/:id/direct-tasks', requireWorkspace, handleAssignEmployeeTask);
aivaRouter.patch('/workers/:id/direct-tasks/:taskId', requireWorkspace, handleUpdateEmployeeTask);
aivaRouter.get('/workers/:id/direct-events', requireWorkspace, handleListEmployeeEvents);

aivaRouter.get('/workers/:id/learning', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const status = String(req.query.status ?? 'all');
  const data = await listAivaLearning({
    workspaceId,
    workerId,
    status: ['pending', 'approved', 'removed', 'auto_saved'].includes(status)
      ? status as 'pending' | 'approved' | 'removed' | 'auto_saved'
      : 'all',
    limit: parseInt(String(req.query.limit ?? '50'), 10) || 50,
  });
  res.json(data);
});

aivaRouter.post('/workers/:id/learning/review', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const result = await runAivaDailyLearningReview({ workspaceId, workerId });
  const data = await listAivaLearning({ workspaceId, workerId, status: 'all', limit: 50 });
  res.json({ result, ...data });
});

aivaRouter.post('/workers/:id/learning/:learningId/approve', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const item = await approveAivaLearningItem({
    workspaceId,
    workerId,
    learningId: routeParam(req.params.learningId),
    reviewedBy: typeof req.body?.reviewedBy === 'string' ? req.body.reviewedBy : 'owner',
  });
  if (!item) {
    res.status(404).json({ error: 'Learning item not found' });
    return;
  }
  res.json({ item });
});

aivaRouter.post('/workers/:id/learning/:learningId/remove', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const item = await removeAivaLearningItem({
    workspaceId,
    workerId,
    learningId: routeParam(req.params.learningId),
    reviewedBy: typeof req.body?.reviewedBy === 'string' ? req.body.reviewedBy : 'owner',
    removeMemory: req.body?.removeMemory !== false,
  });
  if (!item) {
    res.status(404).json({ error: 'Learning item not found' });
    return;
  }
  res.json({ item });
});

aivaRouter.get('/workers/:id', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  const [analytics, messagesTodayResult, overview] = await Promise.all([
    getWorkerAnalytics(workerId, workspaceId).catch(() => null),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM ai_worker_activity
       WHERE worker_id = $1 AND created_at >= CURRENT_DATE`,
      [workerId],
    ),
    getWorkerOverviewMetrics(workerId).catch(() => null),
  ]);

  res.json({
    worker: {
      ...worker,
      messagesToday: Number(messagesTodayResult.rows[0]?.count ?? 0),
      totalMessages: analytics?.totalMessages ?? 0,
      escalationRate: analytics?.escalationRate ?? 0,
      automationsRan: analytics?.automationsRunCount ?? 0,
      lastActiveAt: overview?.lastActiveAt?.toISOString()
        ?? (analytics?.lastActiveAt instanceof Date
          ? analytics.lastActiveAt.toISOString()
          : analytics?.lastActiveAt ?? null),
      conversationsToday: overview?.conversationsToday ?? 0,
      openThreads: overview?.openThreads ?? 0,
      avgResponseTimeMs: overview?.avgResponseTimeMs ?? null,
      pendingApprovals: overview?.pendingApprovals ?? 0,
      openEscalations: overview?.openEscalations ?? 0,
      scout: {
        enabled: process.env.AIVA_SCOUT_FLEET_ENABLED !== 'false',
        registered: analytics?.scoutRegistered ?? false,
        monitoring: worker.status === 'active',
      },
    },
  });
});

aivaRouter.patch('/workers/:id', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.id);
    const existing = await getWorker(req.workspaceId!, workerId);
    if (!existing) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    if (existing.status === 'dismissed') {
      res.status(409).json({ error: 'This Aiva was dismissed and cannot be changed' });
      return;
    }

    const roleName = req.body?.name
      ? String(req.body.name)
      : req.body?.roleName
        ? String(req.body.roleName)
        : undefined;
    const roleDescription = req.body?.roleDescription ? String(req.body.roleDescription) : undefined;
    let personaPrompt: string | undefined;

    if (roleDescription && roleDescription !== existing.roleDescription) {
      if (existing.templateId) {
        const template = getRoleTemplate(existing.templateId);
        if (template) {
          personaPrompt = buildPersonaPrompt(roleName ?? existing.name, template, roleDescription);
        }
      }
      if (!personaPrompt) {
        personaPrompt = buildCustomPersonaPrompt(roleName ?? existing.name, roleDescription);
      }
    }

    if (personaPrompt !== undefined) {
      personaPrompt = stripKnowledgeFromPersona(personaPrompt);
    }

    const language = req.body?.language ? String(req.body.language) : undefined;

    if (req.body?.status === 'paused') {
      await pauseWorker(req.workspaceId!, workerId);
      const worker = await getWorker(req.workspaceId!, workerId);
      res.json({ worker });
      return;
    }
    if (req.body?.status === 'active') {
      await resumeWorker(req.workspaceId!, workerId);
      const worker = await getWorker(req.workspaceId!, workerId);
      res.json({ worker });
      return;
    }

    const incomingConfig =
      req.body?.workerConfig && typeof req.body.workerConfig === 'object'
        ? (req.body.workerConfig as Record<string, unknown>)
        : null;
    const existingConfig = (existing.workerConfig ?? {}) as Record<string, unknown>;
    const mergedTelegram =
      incomingConfig?.telegram && typeof incomingConfig.telegram === 'object'
        ? {
            ...((existingConfig.telegram as Record<string, unknown> | undefined) ?? {}),
            ...(incomingConfig.telegram as Record<string, unknown>),
          }
        : undefined;
    const mergedPrivacy =
      incomingConfig?.privacy && typeof incomingConfig.privacy === 'object'
        ? {
            ...((existingConfig.privacy as Record<string, unknown> | undefined) ?? {}),
            ...(incomingConfig.privacy as Record<string, unknown>),
          }
        : undefined;

    const worker = await updateWorker(req.workspaceId!, workerId, {
      name: roleName,
      roleDescription,
      personaPrompt,
      language: req.body?.language ? String(req.body.language) : undefined,
      workerConfig: incomingConfig
        ? {
            ...existingConfig,
            ...incomingConfig,
            ...(mergedTelegram ? { telegram: mergedTelegram } : {}),
            ...(mergedPrivacy ? { privacy: mergedPrivacy } : {}),
            ...(req.body?.permissions && typeof req.body.permissions === 'object'
              ? { permissions: req.body.permissions }
              : {}),
          }
        : req.body?.permissions && typeof req.body.permissions === 'object'
          ? {
              ...existingConfig,
              permissions: req.body.permissions,
            }
          : undefined,
    });
    res.json({ worker });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = /dismissed|paused/i.test(msg) ? 409 : 500;
    res.status(status).json({ error: msg });
  }
});

aivaRouter.delete('/workers/:id', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const existing = await getWorker(req.workspaceId!, workerId);
  if (!existing) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  await dismissWorker(req.workspaceId!, workerId);
  res.json({ ok: true });
});

aivaRouter.post('/workers/:id/pause', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const existing = await getWorker(req.workspaceId!, workerId);
  if (!existing) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  await pauseWorker(req.workspaceId!, workerId);
  res.json({ ok: true });
});

aivaRouter.get('/workers/:id/activity', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const limit = parseInt(String(req.query.limit ?? '50'), 10) || 50;
  const activity = await listActivity(req.workspaceId!, workerId, limit);
  res.json({ activity });
});

aivaRouter.get('/workers/:id/outbound', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const limit = parseInt(String(req.query.limit ?? '20'), 10) || 20;
  const rows = await listOutboundCommunications(req.workspaceId!, workerId, limit);
  res.json({
    outbound: rows.map((row) => ({
      id: row.id,
      channel: row.channel ?? 'email',
      contactId: row.contactId ? maskIdentifier(row.channel ?? 'email', row.contactId) : '',
      preview: (row.outputText ?? row.summary).slice(0, 280),
      subject: row.actionType === 'message_sent' ? row.summary : undefined,
      status: 'delivered',
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

aivaRouter.get('/workers/:id/audit', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const limit = parseInt(String(req.query.limit ?? '100'), 10) || 100;
  const audit = await listAudit(req.workspaceId!, workerId, limit);
  const planTier = await resolveWorkspacePlanTier(req.workspaceId!);
  const showAttestation = planTier === 'business';
  res.json({
    planTier,
    audit: audit.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      inputSummary: row.inputText ?? row.summary,
      outputSummary: row.outputText ?? null,
      attestationTx: showAttestation ? (row.attestationTx ?? null) : null,
      attestationGated: !showAttestation && Boolean(row.attestationTx),
      createdAt: row.createdAt,
    })),
  });
});

aivaRouter.get('/workers/:id/channels', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  const rows = await listWorkerChannelDetails(workerId);
  const rowByType = new Map(rows.map((r) => [r.channel, r]));
  const planTier = await resolveWorkspacePlanTier(req.workspaceId!);
  const channelLimit = channelLimitForTier(planTier);
  const connectedCount = await countConnectedChannels(workerId, req.workspaceId!);
  const channels = ALL_CHANNEL_TYPES.map((type) => {
    const row = rowByType.get(type as typeof rows[number]['channel']);
    const connectionStatus = resolveChannelConnectionStatus(type, worker.channels, row);
    const configured = connectionStatus !== 'disconnected' && connectionStatus !== 'oauth_pending';
    return {
      id: row?.id ?? type,
      type,
      label: CHANNEL_LABELS[type] ?? type,
      identifier: row?.identifier,
      active: row?.enabled ?? worker.channels.includes(type),
      connected: configured,
      verified: row?.verified ?? false,
      connectionStatus,
    };
  });
  res.json({ channels, planTier, channelLimit, connectedCount });
});

aivaRouter.post('/workers/:id/whatsapp-web/pairing', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const session = await startWhatsAppWebPairing({
    workspaceId: req.workspaceId!,
    workerId,
  });
  res.status(201).json({
    session,
    setupType: 'whatsapp_web',
    recommendedFor: 'Early testing and low-volume teams that need the fastest setup.',
    warnings: whatsappWebOperationalWarnings(),
  });
});

aivaRouter.get('/workers/:id/whatsapp-web/pairing', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const session = await getLatestWhatsAppWebPairing(req.workspaceId!, workerId);
  res.json({
    session,
    setupType: 'whatsapp_web',
    warnings: whatsappWebOperationalWarnings(),
  });
});

aivaRouter.delete('/workers/:id/whatsapp-web/pairing', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const session = await revokeWhatsAppWebPairing(req.workspaceId!, workerId);
  res.json({
    ok: true,
    session,
  });
});

aivaRouter.get('/connector-scopes/catalog', requireWorkspace, async (_req: AivaRequest, res: Response) => {
  const { CONNECTOR_RESOURCE_CATALOG } = await import('../security/connector-resource-scopes.js');
  res.json({
    connectors: CONNECTOR_RESOURCE_CATALOG.map((c) => ({
      connector: c.connector,
      label: c.label,
      kinds: c.kinds.map((k) => ({ kind: k.kind, label: k.label, matchMode: k.matchMode ?? 'exact' })),
    })),
  });
});

aivaRouter.get('/connector-scopes', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const { listResourceGrants } = await import('../security/connector-resource-scopes.js');
  const workerId = typeof req.query.workerId === 'string' ? req.query.workerId : undefined;
  const connector = typeof req.query.connector === 'string' ? req.query.connector : undefined;
  const grants = await listResourceGrants(req.workspaceId!, { workerId, connector });
  const modeByConnector = new Map<string, 'scoped' | 'broad'>();
  for (const g of grants) modeByConnector.set(g.connector, 'scoped');
  res.json({
    grants,
    modes: Object.fromEntries(
      (await import('../security/connector-resource-scopes.js')).CONNECTOR_RESOURCE_CATALOG.map((c) => [
        c.connector,
        modeByConnector.get(c.connector) ?? 'broad',
      ]),
    ),
  });
});

aivaRouter.post('/connector-scopes', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const { grantConnectorResource } = await import('../security/connector-resource-scopes.js');
  try {
    const grant = await grantConnectorResource({
      workspaceId: req.workspaceId!,
      workerId: req.body?.workerId ? String(req.body.workerId) : null,
      connector: String(req.body?.connector ?? ''),
      resourceKind: String(req.body?.resourceKind ?? ''),
      resourceId: String(req.body?.resourceId ?? ''),
      label: req.body?.label ? String(req.body.label) : undefined,
      actions: Array.isArray(req.body?.actions) ? req.body.actions : undefined,
      actor: 'workspace',
    });
    res.status(201).json({ grant });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Grant failed' });
  }
});

aivaRouter.delete('/connector-scopes/:grantId', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const { revokeConnectorResource } = await import('../security/connector-resource-scopes.js');
  const grantId = Number(req.params.grantId);
  if (!Number.isFinite(grantId)) {
    res.status(400).json({ error: 'Invalid grant id' });
    return;
  }
  const ok = await revokeConnectorResource({
    workspaceId: req.workspaceId!,
    grantId,
    actor: 'workspace',
  });
  if (!ok) {
    res.status(404).json({ error: 'Grant not found' });
    return;
  }
  res.json({ ok: true });
});

aivaRouter.get('/client-approvals', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const { listClientApprovals, listTokenSuspensions } = await import('../security/client-approval-store.js');
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const approvals = await listClientApprovals(
    req.workspaceId!,
    status as 'pending' | 'approved' | 'denied' | 'revoked' | 'expired' | undefined,
  );
  const suspensions = await listTokenSuspensions(req.workspaceId!);
  res.json({ approvals, suspensions });
});

aivaRouter.post('/client-approvals/:approvalId/decide', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const { decideClientApproval } = await import('../security/client-approval-store.js');
  const decision = String(req.body?.decision ?? '');
  if (!['approved', 'denied', 'revoked'].includes(decision)) {
    res.status(400).json({ error: 'decision must be approved, denied, or revoked' });
    return;
  }
  const approvalId = Number(req.params.approvalId);
  if (!Number.isFinite(approvalId)) {
    res.status(400).json({ error: 'Invalid approval id' });
    return;
  }
  const record = await decideClientApproval({
    tenantId: req.workspaceId!,
    approvalId,
    decision: decision as 'approved' | 'denied' | 'revoked',
    expiresInDays: req.body?.expiresInDays ? Number(req.body.expiresInDays) : undefined,
  });
  if (!record) {
    res.status(404).json({ error: 'Approval not found' });
    return;
  }
  res.json({ approval: record });
});

aivaRouter.post('/tokens/:tokenId/unsuspend', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const { unsuspendToken } = await import('../security/client-approval-store.js');
  const ok = await unsuspendToken(String(req.params.tokenId));
  if (!ok) {
    res.status(404).json({ error: 'Token is not suspended' });
    return;
  }
  res.json({ ok: true });
});

aivaRouter.patch('/workers/:id/channels/:channelId', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const channelId = routeParam(req.params.channelId);
  const workspaceId = req.workspaceId!;

  const rows = await listWorkerChannelDetails(workerId);
  const row = UUID_RE.test(channelId)
    ? rows.find((r) => r.id === channelId)
    : rows.find((r) => r.channel === channelId);
  if (!row) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  const enabled = Boolean(req.body?.active);
  const updated = await setChannelEnabled(workspaceId, row.id, enabled);
  if (!updated) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  if (enabled) {
    registerChannel(updated.channel, updated.identifier, {
      workerId: updated.workerId,
      workspaceId: updated.workspaceId,
      channelRowId: updated.id,
      credentialBlob: updated.credentials.encrypted ?? '',
    });
  } else {
    unregisterChannel(updated.channel, updated.identifier);
  }

  res.json({ ok: true, active: enabled });
});

aivaRouter.delete('/workers/:id/channels/:channelId', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const channelId = routeParam(req.params.channelId);
  const workspaceId = req.workspaceId!;

  const rows = await listWorkerChannelDetails(workerId);
  const row = UUID_RE.test(channelId)
    ? rows.find((r) => r.id === channelId)
    : rows.find((r) => r.channel === channelId);
  if (!row) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  const removed = await removeWorkerChannel(workerId, row.id);
  if (!removed) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }

  unregisterChannel(row.channel, row.identifier);
  res.json({ ok: true });
});

aivaRouter.get('/workers/:id/conversations', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const limit = parseInt(String(req.query.limit ?? '5'), 10) || 5;
  const result = await pool.query(
    `SELECT id, channel, contact_id, last_message_at, message_count
     FROM channel_threads
     WHERE worker_id = $1
     ORDER BY last_message_at DESC NULLS LAST
     LIMIT $2`,
    [workerId, limit],
  );
  res.json({
    conversations: result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      channel: String(row.channel),
      contactId: String(row.contact_id),
      lastMessageAt: row.last_message_at ? new Date(String(row.last_message_at)).toISOString() : null,
      messageCount: Number(row.message_count ?? 0),
    })),
  });
});

/** Channel sync: list linked identities + pullable chats for a channel peer. */
aivaRouter.get('/workers/:id/channel-sync', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const channel = typeof req.query.channel === 'string' ? req.query.channel.trim() : '';
  const contactId = typeof req.query.contactId === 'string' ? req.query.contactId.trim() : '';
  if (!channel || !contactId) {
    res.status(400).json({ error: 'channel and contactId query params are required' });
    return;
  }

  const {
    listChannelSyncConversations,
  } = await import('../memory/aiva/contact-identity.js');
  const { resolveAivaSessionWithOwnerAuto } = await import('../memory/aiva/owner-auto-sync.js');
  const { mirrorOwnerSharedHistoryIntoWebThread } = await import('../memory/aiva/owner-web-mirror.js');
  const { hydrateCanonicalSessionFromLinkedChannels } = await import('../memory/aiva/session-hydrate.js');

  const resolved = await resolveAivaSessionWithOwnerAuto({
    workspaceId,
    workerId,
    channel,
    contactId,
  });

  // Bind is enough for the status response. Hydrate/mirror in the background so
  // the Chat tab banner does not wait on a slow merge (proxy timeouts returned HTML).
  if (resolved.ownerAuto || resolved.linked) {
    void hydrateCanonicalSessionFromLinkedChannels({
      workspaceId,
      workerId,
      canonicalContactId: resolved.canonicalContactId,
      sessionId: resolved.sessionId,
      channel,
      linked: true,
    }).catch(() => ({ hydrated: 0 }));
  }

  if (resolved.ownerAuto && channel === 'web') {
    void mirrorOwnerSharedHistoryIntoWebThread({
      workspaceId,
      workerId,
      contactId,
      sessionId: resolved.sessionId,
    }).catch(() => ({ mirrored: 0, messages: [], threadId: '' }));
  }

  const conversations = await listChannelSyncConversations({
    workspaceId,
    workerId,
    canonicalContactId: resolved.canonicalContactId,
    limit: parseInt(String(req.query.limit ?? '20'), 10) || 20,
  });

  res.json({
    canonicalContactId: resolved.canonicalContactId,
    sessionId: resolved.sessionId,
    linked: resolved.linked || resolved.ownerAuto,
    ownerAuto: Boolean(resolved.ownerAuto),
    identities: resolved.identities.map((row) => ({
      channel: row.channel,
      contactId: row.channelContactId,
      displayName: row.displayName,
      isPrimary: row.isPrimary,
      lastSeenAt: new Date(row.lastSeenAt).toISOString(),
    })),
    conversations,
  });
});

aivaRouter.post('/workers/:id/channel-sync/link/code', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const channel = typeof req.body?.channel === 'string' ? req.body.channel.trim() : '';
  const contactId = typeof req.body?.contactId === 'string' ? req.body.contactId.trim() : '';
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : undefined;
  if (!channel || !contactId) {
    res.status(400).json({ error: 'channel and contactId are required' });
    return;
  }

  const {
    resolveAivaCanonicalContact,
    generateAivaLinkCode,
  } = await import('../memory/aiva/contact-identity.js');

  const resolved = await resolveAivaCanonicalContact({
    workspaceId,
    workerId,
    channel,
    channelContactId: contactId,
    displayName,
  });
  const code = generateAivaLinkCode({
    workspaceId,
    workerId,
    canonicalContactId: resolved.canonicalContactId,
    channel,
    channelContactId: contactId,
    displayName,
  });
  res.json({
    code,
    expiresInSeconds: 300,
    claimCommand: `/link claim ${code}`,
    canonicalContactId: resolved.canonicalContactId,
    sessionId: resolved.sessionId,
  });
});

aivaRouter.post('/workers/:id/channel-sync/link/claim', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const channel = typeof req.body?.channel === 'string' ? req.body.channel.trim() : '';
  const contactId = typeof req.body?.contactId === 'string' ? req.body.contactId.trim() : '';
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : undefined;
  if (!code || !channel || !contactId) {
    res.status(400).json({ error: 'code, channel, and contactId are required' });
    return;
  }

  const {
    claimAivaLinkCode,
    linkAivaChannelContact,
    aivaCanonicalSessionId,
  } = await import('../memory/aiva/contact-identity.js');
  const { hydrateCanonicalSessionFromLinkedChannels } = await import('../memory/aiva/session-hydrate.js');

  const claimed = claimAivaLinkCode(code, {
    workspaceId,
    workerId,
    channel,
    channelContactId: contactId,
  });
  if ('error' in claimed) {
    res.status(400).json({ error: claimed.error });
    return;
  }

  const identities = await linkAivaChannelContact({
    workspaceId: claimed.workspaceId,
    workerId: claimed.workerId,
    canonicalContactId: claimed.canonicalContactId,
    channel,
    channelContactId: contactId,
    displayName,
  });
  const sessionId = aivaCanonicalSessionId(workerId, claimed.canonicalContactId);
  await hydrateCanonicalSessionFromLinkedChannels({
    workspaceId,
    workerId,
    canonicalContactId: claimed.canonicalContactId,
    sessionId,
    channel,
    linked: true,
  }).catch(() => ({ hydrated: 0 }));

  res.json({
    ok: true,
    canonicalContactId: claimed.canonicalContactId,
    sessionId,
    identities: identities.map((row) => ({
      channel: row.channel,
      contactId: row.channelContactId,
      displayName: row.displayName,
      isPrimary: row.isPrimary,
    })),
  });
});

/** Bind this channel peer onto an existing canonical contact (pull chat here). */
aivaRouter.post('/workers/:id/channel-sync/continue', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const channel = typeof req.body?.channel === 'string' ? req.body.channel.trim() : '';
  const contactId = typeof req.body?.contactId === 'string' ? req.body.contactId.trim() : '';
  const targetCanonicalContactId = typeof req.body?.targetCanonicalContactId === 'string'
    ? req.body.targetCanonicalContactId.trim()
    : '';
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : undefined;
  if (!channel || !contactId || !targetCanonicalContactId) {
    res.status(400).json({
      error: 'channel, contactId, and targetCanonicalContactId are required',
    });
    return;
  }

  const {
    linkAivaChannelContact,
    aivaCanonicalSessionId,
  } = await import('../memory/aiva/contact-identity.js');
  const { hydrateCanonicalSessionFromLinkedChannels } = await import('../memory/aiva/session-hydrate.js');

  const identities = await linkAivaChannelContact({
    workspaceId,
    workerId,
    canonicalContactId: targetCanonicalContactId,
    channel,
    channelContactId: contactId,
    displayName,
  });
  const sessionId = aivaCanonicalSessionId(workerId, targetCanonicalContactId);
  await hydrateCanonicalSessionFromLinkedChannels({
    workspaceId,
    workerId,
    canonicalContactId: targetCanonicalContactId,
    sessionId,
    channel,
    linked: true,
  }).catch(() => ({ hydrated: 0 }));

  res.json({
    ok: true,
    canonicalContactId: targetCanonicalContactId,
    sessionId,
    identities: identities.map((row) => ({
      channel: row.channel,
      contactId: row.channelContactId,
      displayName: row.displayName,
      isPrimary: row.isPrimary,
    })),
  });
});

aivaRouter.post('/subscription/trial', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const ownerEmail = typeof req.body?.ownerEmail === 'string' ? req.body.ownerEmail.trim() : '';
    const ownerName = typeof req.body?.ownerName === 'string' ? req.body.ownerName.trim() : '';
    const sendWelcome = req.body?.sendWelcome !== false;

    const existingSub = await getSubscription(workspaceId);
    const isNew = !existingSub;

    if (ownerEmail) {
      await upsertWorkspaceContact(workspaceId, ownerEmail, ownerName);
    }

    const result = await provisionTrial(workspaceId);

    if (isNew && ownerEmail && sendWelcome) {
      void sendWelcomeEmail({ workspaceId, email: ownerEmail, name: ownerName }).catch((err) => {
        console.error('[aiva-api] welcome email failed:', err);
      });
    }

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

aivaRouter.get('/subscription/status', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const status = await getSubscriptionStatus(req.workspaceId!);
  const tier = String(status.planTier ?? 'trial');
  const tierConfig = toolsetsForAivaTier(tier);
  const allowedTools = resolveToolset(tierConfig.toolsets).filter(
    (t) => !tierConfig.blockedTools.includes(t),
  );
  res.json({
    ...status,
    allowedToolsets: tierConfig.toolsets,
    toolCount: allowedTools.length,
  });
});

aivaRouter.get('/scout/governance', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const { getAivaScoutWorkspace } = await import('../billing/aiva-scout-store.js');
  const { pool } = await import('../memory/db.js');
  const workspaceId = req.workspaceId!;
  const scout = await getAivaScoutWorkspace(workspaceId);
  const workers = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'active')::int AS active,
            COUNT(*) FILTER (WHERE status = 'suspended_by_scout')::int AS suspended_by_scout
     FROM ai_workers WHERE workspace_id = $1 AND status != 'dismissed'`,
    [workspaceId],
  );
  const events24h = await pool.query(
    `SELECT COUNT(*)::int AS n FROM aiva_scout_event_queue
     WHERE workspace_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
    [workspaceId],
  );
  const row = workers.rows[0] as { total?: number; active?: number; suspended_by_scout?: number };
  res.json({
    scoutStatus: scout?.scoutStatus ?? 'pending',
    scoutDashboardUrl: scout?.scoutDashboardUrl ?? null,
    scoutLastHeartbeatAt: scout?.scoutLastHeartbeatAt?.toISOString() ?? null,
    employeesMonitored: Number(row?.total ?? 0),
    employeesActive: Number(row?.active ?? 0),
    employeesSuspendedByScout: Number(row?.suspended_by_scout ?? 0),
    eventsLast24h: Number(events24h.rows[0]?.n ?? 0),
    killSwitchActive: Number(row?.suspended_by_scout ?? 0) > 0,
  });
});

aivaRouter.post('/scout/provision', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    const { provisionAivaScoutWorkspace } = await import('../billing/aiva-scout-provisioning.js');
    const sub = await getSubscription(req.workspaceId!);
    const result = await provisionAivaScoutWorkspace({
      workspaceId: req.workspaceId!,
      tier: sub?.planTier ?? 'starter',
      email: typeof req.body?.email === 'string' ? req.body.email : undefined,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

aivaRouter.get('/billing/pricing', async (_req, res) => {
  res.json({ plans: await loadAivaPricingPlans() });
});

aivaRouter.get('/billing/status', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const status = await getBillingStatus(req.workspaceId!);
  const downgrade = await getDowngradeConflictFields(req.workspaceId!);
  res.json({ ...status, ...downgrade });
});

aivaRouter.get('/billing/invoices', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const invoices = await listAivaInvoices(req.workspaceId!);
  res.json({ invoices });
});

aivaRouter.post('/billing/checkout', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    const tier = String(req.body?.tier ?? 'starter');
    const { isAivaAssignableCheckoutTier } = await import('../billing/aiva-tier.js');
    if (!isAivaAssignableCheckoutTier(tier)) {
      res.status(400).json({ error: 'Invalid tier' });
      return;
    }
    const interval = req.body?.interval === 'year' ? 'year' : 'month';
    const successUrl = String(req.body?.successUrl ?? `${aivaAppUrl('/billing/aiva')}?checkout=success`);
    const cancelUrl = String(req.body?.cancelUrl ?? `${aivaAppUrl('/billing/aiva')}?checkout=cancel`);
    const email = typeof req.body?.email === 'string' ? req.body.email : undefined;
    const session = await createAivaCheckoutSession({
      workspaceId: req.workspaceId!,
      tier,
      interval,
      successUrl,
      cancelUrl,
      customerEmail: email,
    });
    res.json(session);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(billingErrorStatus(msg)).json({ error: msg });
  }
});

aivaRouter.post('/billing/topup', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    const packId = String(req.body?.packId ?? '');
    if (!isAivaPrepaidPackId(packId)) {
      res.status(400).json({ error: 'Invalid prepaid pack' });
      return;
    }
    const successUrl = String(
      req.body?.successUrl ?? `${aivaAppUrl('/billing/aiva')}?topup=success`,
    );
    const cancelUrl = String(
      req.body?.cancelUrl ?? `${aivaAppUrl('/billing/aiva')}?topup=cancel`,
    );
    const email = typeof req.body?.email === 'string' ? req.body.email : undefined;
    const session = await createAivaPrepaidCheckoutSession({
      workspaceId: req.workspaceId!,
      packId,
      successUrl,
      cancelUrl,
      customerEmail: email,
    });
    res.json(session);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(billingErrorStatus(msg)).json({ error: msg });
  }
});

aivaRouter.post('/billing/resolve-downgrade', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    const keepWorkerIds = Array.isArray(req.body?.keepWorkerIds)
      ? req.body.keepWorkerIds.map(String)
      : [];
    const result = await resolveDowngradeConflict(req.workspaceId!, keepWorkerIds);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

aivaRouter.post('/billing/portal', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    const returnUrl = String(req.body?.returnUrl ?? aivaAppUrl('/billing/aiva'));
    const session = await createAivaPortalSession({
      workspaceId: req.workspaceId!,
      returnUrl,
    });
    res.json(session);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(billingErrorStatus(msg)).json({ error: msg });
  }
});

aivaRouter.get('/workers/:id/analytics', async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  if (!UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'Invalid worker id' });
    return;
  }

  const token = req.headers['x-scout-token'];
  const expected = process.env.SCOUT_OPS_TOKEN ?? '';
  const provided = Array.isArray(token) ? token[0] : token;
  const scoutAuthed = Boolean(expected && provided === expected);

  let workspaceId = resolveWorkspaceId(req);
  if (workspaceId && !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Invalid workspaceId' });
    return;
  }
  if (!workspaceId && scoutAuthed) {
    const worker = await getWorkerById(workerId);
    workspaceId = worker?.workspaceId ?? null;
  }

  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required' });
    return;
  }

  if (!scoutAuthed) {
    if (!isAiWorkersEnabled()) {
      res.status(503).json({ error: 'AI workers are disabled' });
      return;
    }
    const worker = await getWorker(workspaceId, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
  }

  try {
    const analytics = await getWorkerAnalytics(workerId, workspaceId);
    res.json(analytics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: msg });
  }
});

aivaRouter.get('/workers/:id/automations', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const existing = await getWorker(req.workspaceId!, workerId);
  if (!existing) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const automations = await listAutomations(workerId);
  res.json({ automations });
});

aivaRouter.post('/workers/:id/automations', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.id);
    const existing = await getWorker(req.workspaceId!, workerId);
    if (!existing) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const scheduleText = String(req.body?.scheduleText ?? '').trim();
    const triggerKind = String(req.body?.triggerKind ?? req.body?.triggerType ?? 'schedule');
    const actionType = String(req.body?.actionType ?? 'aiva_prompt');
    const approvalMode = String(req.body?.approvalMode ?? 'require_write');
    const timezone = String(req.body?.timezone ?? 'UTC');

    if (!name || !description) {
      res.status(400).json({ error: 'name and description are required' });
      return;
    }

    const {
      computeNextRun,
      parseScheduleInput,
      normalizeSchedule,
    } = await import('../workers/automation-trigger-schema.js');

    let cronExpression = '0 * * * *';
    let scheduleLabel = 'Manual';
    let scheduleJson: Record<string, unknown> | null = null;
    let nextRunAt: Date | null = null;
    let triggerType: 'cron' | 'event' | 'schedule' = 'schedule';
    let triggerEvent: string | undefined;

    if (triggerKind === 'event') {
      triggerType = 'event';
      triggerEvent = String(req.body?.triggerEvent ?? req.body?.eventSource ?? 'webhook');
      scheduleLabel = `On ${triggerEvent}`;
      cronExpression = '';
    } else if (req.body?.schedule && typeof req.body.schedule === 'object') {
      const parsed = parseScheduleInput({ schedule: req.body.schedule });
      cronExpression = parsed.cronExpression;
      scheduleLabel = parsed.label;
      scheduleJson = parsed.schedule as unknown as Record<string, unknown>;
      nextRunAt = computeNextRun(parsed.schedule, timezone, new Date());
      triggerType = 'schedule';
    } else if (scheduleText) {
      const parsedNl = await parseScheduleText(scheduleText);
      cronExpression = parsedNl.cronExpression;
      scheduleLabel = parsedNl.scheduleLabel;
      scheduleJson = { type: 'cron', cron: cronExpression };
      nextRunAt = computeNextRun(
        normalizeSchedule({ type: 'cron', cron: cronExpression }),
        timezone,
        new Date(),
      );
      triggerType = 'cron';
    } else {
      res.status(400).json({ error: 'schedule, scheduleText, or event trigger is required' });
      return;
    }

    const actionJson = req.body?.action && typeof req.body.action === 'object'
      ? req.body.action
      : { type: actionType, prompt: description };

    const automation = await createAutomation(workerId, req.workspaceId!, {
      name,
      description,
      cronExpression,
      scheduleLabel,
      triggerType,
      triggerEvent,
      timezone,
      scheduleJson,
      actionType,
      actionJson,
      conditionsJson: Array.isArray(req.body?.conditions) ? req.body.conditions : [],
      approvalMode,
      nextRunAt,
    });

    if (triggerType !== 'event' && automation.cronExpression) {
      registerAutomationJob(automation.id, automation.cronExpression, automation.timezone);
    }
    res.status(201).json({ automation });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

aivaRouter.get('/workers/:id/automations/:automationId/runs', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const automationId = routeParam(req.params.automationId);
  const automation = await getAutomation(automationId);
  if (!automation || automation.workerId !== workerId) {
    res.status(404).json({ error: 'Automation not found' });
    return;
  }
  const { listAutomationRuns } = await import('../workers/automation-run-queue.js');
  const runs = await listAutomationRuns(automationId);
  res.json({ runs });
});

aivaRouter.post('/workers/:id/automations/:automationId/test', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const automationId = routeParam(req.params.automationId);
  const automation = await getAutomation(automationId);
  if (!automation || automation.workerId !== workerId) {
    res.status(404).json({ error: 'Automation not found' });
    return;
  }
  const { enqueueAutomationRun } = await import('../workers/automation-run-queue.js');
  const { tickAutomationWorkers } = await import('../workers/automation-trigger-engine.js');
  const run = await enqueueAutomationRun({
    automationId,
    workerId,
    workspaceId: req.workspaceId!,
    triggerKind: automation.triggerType === 'event' ? 'event' : 'schedule',
    payload: (req.body?.payload && typeof req.body.payload === 'object') ? req.body.payload : { test: true },
    actor: 'test-run',
  });
  if (!run) {
    res.status(409).json({ error: 'A run is already queued for this automation' });
    return;
  }
  await tickAutomationWorkers(1);
  const { listAutomationRuns } = await import('../workers/automation-run-queue.js');
  const runs = await listAutomationRuns(automationId, 1);
  res.json({ run: runs[0] ?? run });
});

aivaRouter.post('/workers/:id/automations/runs/:runId/approve', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const runId = routeParam(req.params.runId);
  const { approveAutomationRun, listAutomationRuns } = await import('../workers/automation-run-queue.js');
  const approved = await approveAutomationRun(runId, 'workspace');
  if (!approved || approved.workerId !== workerId) {
    res.status(404).json({ error: 'Run not found or not awaiting approval' });
    return;
  }
  const { tickAutomationWorkers } = await import('../workers/automation-trigger-engine.js');
  await tickAutomationWorkers(1);
  const runs = await listAutomationRuns(approved.automationId, 5);
  res.json({ run: runs.find((r) => r.id === runId) ?? approved });
});

aivaRouter.patch('/workers/:id/automations/:automationId', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const automationId = routeParam(req.params.automationId);
  const automation = await getAutomation(automationId);
  if (!automation || automation.workerId !== workerId) {
    res.status(404).json({ error: 'Automation not found' });
    return;
  }
  const enabled = Boolean(req.body?.enabled);
  await toggleAutomation(automationId, enabled);
  if (enabled && automation.triggerType !== 'event') {
    registerAutomationJob(automationId, automation.cronExpression, automation.timezone);
  } else {
    unregisterAutomationJob(automationId);
  }
  res.json({ ok: true });
});

aivaRouter.delete('/workers/:id/automations/:automationId', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const automationId = routeParam(req.params.automationId);
  const automation = await getAutomation(automationId);
  if (!automation || automation.workerId !== workerId) {
    res.status(404).json({ error: 'Automation not found' });
    return;
  }
  unregisterAutomationJob(automationId);
  await deleteAutomation(automationId);
  res.json({ ok: true });
});

aivaRouter.get('/automations/noisy', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  const { listNoisyAutomations } = await import('../workers/automation-run-queue.js');
  const noisy = await listNoisyAutomations();
  const scoped = noisy.filter((n) => n.workspaceId === req.workspaceId);
  res.json({ automations: scoped });
});

aivaRouter.get('/escalations', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const escalations = await listOpenEscalations(workspaceId);
  const workerIds = [...new Set(escalations.map((row) => row.workerId))];
  const workerNames = new Map<string, string>();
  await Promise.all(
    workerIds.map(async (id) => {
      const w = await getWorker(workspaceId, id);
      if (w) workerNames.set(id, w.name);
    }),
  );
  res.json({
    escalations: escalations.map((row) => ({
      id: row.id,
      workerId: row.workerId,
      workerName: workerNames.get(row.workerId) ?? 'Aiva',
      channel: row.channel,
      status: row.status,
      originalInput: row.originalInput,
      holdingMessage: row.holdingMessage,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

aivaRouter.post('/escalations/:id/dismiss', requireWorkspace, requireTeamPlan, async (req: AivaRequest, res: Response) => {
  const escalationId = routeParam(req.params.id);
  const note = typeof req.body?.note === 'string' && req.body.note.trim()
    ? req.body.note.trim().slice(0, 500)
    : 'Dismissed by workspace owner';
  const ok = await dismissOpenEscalation(req.workspaceId!, escalationId, note);
  if (!ok) {
    res.status(404).json({ error: 'Open escalation not found' });
    return;
  }
  res.json({ ok: true });
});

aivaRouter.get('/templates', (_req, res) => {
  res.json({ templates: ROLE_TEMPLATES, playbookTemplates: listAivaPlaybookTemplates() });
});

function requirePropreneurBridge(req: AivaRequest, res: Response, next: NextFunction): void {
  if (!isPropreneurBridgeEnabled()) {
    res.status(503).json({ error: 'Propreneur bridge is disabled' });
    return;
  }
  next();
}

aivaRouter.post('/workers/:id/propreneur/bind', requireWorkspace, requirePropreneurBridge, async (req: AivaRequest, res: Response) => {
  try {
    if (!credentialsConfigured()) {
      res.status(503).json({ error: 'CHANNEL_CREDENTIAL_KEY is not configured' });
      return;
    }

    const workerId = routeParam(req.params.id);
    const tenantSlug = String(req.body?.tenantSlug ?? req.body?.propreneurTenantSlug ?? '').trim();
    const apiKey = String(req.body?.apiKey ?? req.body?.propreneurBridgeKey ?? '').trim();

    if (!UUID_RE.test(workerId) || !tenantSlug || !apiKey) {
      res.status(400).json({ error: 'worker id, tenantSlug, and apiKey are required' });
      return;
    }

    const worker = await getWorker(req.workspaceId!, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const result = await validateAndSetPropreneurBinding(req.workspaceId!, workerId, tenantSlug, apiKey);
    res.json({ ok: true, tenantSlug: result.tenantSlug, propertyCount: result.propertyCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

aivaRouter.delete('/workers/:id/propreneur/bind', requireWorkspace, requirePropreneurBridge, async (req: AivaRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.id);
    if (!UUID_RE.test(workerId)) {
      res.status(400).json({ error: 'Invalid worker id' });
      return;
    }
    const worker = await getWorker(req.workspaceId!, workerId);
    if (!worker) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }
    await clearPropreneurBinding(req.workspaceId!, workerId);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

aivaRouter.get('/workers/:id/propreneur/status', requireWorkspace, requirePropreneurBridge, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const binding = resolvePropreneurBinding(worker);
  res.set('Cache-Control', 'no-store').json({
    bound: Boolean(binding),
    tenantSlug: worker.propreneurTenantSlug ?? null,
    summaryEnabled: Boolean(worker.workerConfig?.summary?.enabled),
    summarySchedule: worker.workerConfig?.summary?.summarySchedule ?? null,
    connectToken: createPropreneurConnectToken(req.workspaceId!, workerId),
  });
});

aivaRouter.get('/workspace/profile', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const contact = await getWorkspaceContact(req.workspaceId!);
  if (!contact) {
    res.json({ profile: null });
    return;
  }
  res.json({ profile: serializeWorkspaceProfile(contact) });
});

aivaRouter.patch('/workspace/profile', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  let contact = await getWorkspaceContact(workspaceId);
  const ownerEmail = typeof req.body?.ownerEmail === 'string' ? req.body.ownerEmail.trim() : '';
  if (!contact && ownerEmail) {
    contact = await upsertWorkspaceContact(
      workspaceId,
      ownerEmail,
      typeof req.body?.ownerName === 'string' ? req.body.ownerName : '',
    );
  }
  if (!contact) {
    res.status(404).json({ error: 'Workspace profile not found' });
    return;
  }
  const updated = await updateWorkspaceOwnerProfile(workspaceId, {
    ownerName: typeof req.body?.ownerName === 'string' ? req.body.ownerName : undefined,
    ownerPhone: typeof req.body?.ownerPhone === 'string' ? req.body.ownerPhone : undefined,
    preferredName: typeof req.body?.preferredName === 'string' ? req.body.preferredName : undefined,
    workFunction: typeof req.body?.workFunction === 'string' ? req.body.workFunction : undefined,
    personalPreferences: typeof req.body?.personalPreferences === 'string'
      ? req.body.personalPreferences
      : undefined,
    marketingOptOut: typeof req.body?.marketingOptOut === 'boolean' ? req.body.marketingOptOut : undefined,
  });
  res.json({ profile: updated ? serializeWorkspaceProfile(updated) : serializeWorkspaceProfile(contact) });
});

aivaRouter.post('/workspace/export', requireWorkspace, requireBusinessPlan, async (req: AivaRequest, res: Response) => {
  try {
    await streamWorkspaceExportZip(req.workspaceId!, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

aivaRouter.delete('/workspace', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    await eraseWorkspaceData(req.workspaceId!);
    res.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

aivaRouter.get('/workers/:id/knowledge', requireWorkspace, requireBusinessPlan, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const existing = await getWorker(req.workspaceId!, workerId);
  if (!existing) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }
  const entries = await listKnowledgeSummaries(workerId);
  const usedChars = await getKnowledgeCharTotal(workerId);
  const sub = await getSubscription(req.workspaceId!);
  res.json({
    entries,
    usedChars,
    maxChars: KNOWLEDGE_CHAR_LIMIT,
    planTier: sub?.planTier ?? 'trial',
  });
});

aivaRouter.post('/workers/:id/knowledge/document', requireWorkspace, requireBusinessPlan, async (req: AivaRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.id);
    const existing = await getWorker(req.workspaceId!, workerId);
    if (!existing) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const title = String(req.body?.title ?? req.body?.filename ?? 'Document').trim() || 'Document';
    const filename = String(req.body?.filename ?? 'upload.txt').trim();
    const data = String(req.body?.data ?? '').trim();
    if (!data) {
      res.status(400).json({ error: 'data (base64 file content) is required' });
      return;
    }

    const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'File must be 5MB or smaller' });
      return;
    }

    const rawText = await extractDocumentText(filename, buffer);
    const content = truncateDocumentText(rawText);
    if (!content.trim()) {
      res.status(400).json({ error: 'No text could be extracted from the file' });
      return;
    }

    const charCount = content.length;
    const currentTotal = await getKnowledgeCharTotal(workerId);
    if (currentTotal + charCount > KNOWLEDGE_CHAR_LIMIT) {
      res.status(400).json({ error: `Knowledge base limit (${KNOWLEDGE_CHAR_LIMIT} chars) would be exceeded` });
      return;
    }

    const inserted = await pool.query(
      `INSERT INTO aiva_knowledge_base (worker_id, workspace_id, type, title, content, char_count)
       VALUES ($1, $2, 'document', $3, $4, $5)
       RETURNING id, title, char_count, type, enabled, created_at`,
      [workerId, req.workspaceId!, title, content, charCount],
    );
    const row = inserted.rows[0];
    res.status(201).json({
      id: String(row.id),
      title: String(row.title),
      charCount: Number(row.char_count),
      type: String(row.type),
      enabled: Boolean(row.enabled),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

aivaRouter.post('/workers/:id/knowledge/faq', requireWorkspace, requireBusinessPlan, async (req: AivaRequest, res: Response) => {
  try {
    const workerId = routeParam(req.params.id);
    const existing = await getWorker(req.workspaceId!, workerId);
    if (!existing) {
      res.status(404).json({ error: 'Worker not found' });
      return;
    }

    const question = String(req.body?.question ?? '').trim();
    const answer = String(req.body?.answer ?? '').trim();
    if (!question || !answer) {
      res.status(400).json({ error: 'question and answer are required' });
      return;
    }
    if (question.length + answer.length > FAQ_PAIR_CHAR_LIMIT) {
      res.status(400).json({ error: `FAQ pair must be under ${FAQ_PAIR_CHAR_LIMIT} characters combined` });
      return;
    }

    const content = `Q: ${question}\nA: ${answer}`;
    const charCount = content.length;
    const currentTotal = await getKnowledgeCharTotal(workerId);
    if (currentTotal + charCount > KNOWLEDGE_CHAR_LIMIT) {
      res.status(400).json({ error: `Knowledge base limit (${KNOWLEDGE_CHAR_LIMIT} chars) would be exceeded` });
      return;
    }

    const inserted = await pool.query(
      `INSERT INTO aiva_knowledge_base (worker_id, workspace_id, type, title, content, char_count)
       VALUES ($1, $2, 'faq', $3, $4, $5)
       RETURNING id, title, char_count, type, enabled, created_at`,
      [workerId, req.workspaceId!, question, content, charCount],
    );
    const row = inserted.rows[0];
    res.status(201).json({
      id: String(row.id),
      title: String(row.title),
      charCount: Number(row.char_count),
      type: String(row.type),
      enabled: Boolean(row.enabled),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

aivaRouter.patch('/workers/:id/knowledge/:entryId', requireWorkspace, requireBusinessPlan, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const entryId = routeParam(req.params.entryId);
  const existing = await getWorker(req.workspaceId!, workerId);
  if (!existing) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  const enabled = req.body?.enabled;
  if (enabled === undefined) {
    res.status(400).json({ error: 'enabled is required' });
    return;
  }

  const updated = await pool.query(
    `UPDATE aiva_knowledge_base SET enabled = $3
     WHERE id = $1 AND worker_id = $2 AND workspace_id = $4
     RETURNING id`,
    [entryId, workerId, Boolean(enabled), req.workspaceId!],
  );
  if (updated.rows.length === 0) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }
  res.json({ ok: true });
});

aivaRouter.delete('/workers/:id/knowledge/:entryId', requireWorkspace, requireBusinessPlan, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const entryId = routeParam(req.params.entryId);
  const existing = await getWorker(req.workspaceId!, workerId);
  if (!existing) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  try {
    const { getBinding } = await import('../aiva/workspace-ops/store.js');
    const { pushDocumentToDrive } = await import('../aiva/workspace-ops/sync-engine.js');
    const binding = await getBinding(req.workspaceId!, workerId);
    if (binding?.rootFolderId) {
      await pushDocumentToDrive({ binding, documentId: entryId, trash: true });
    }
  } catch (err) {
    console.warn(
      '[workspace-ops] Drive trash on knowledge delete failed:',
      err instanceof Error ? err.message : err,
    );
  }

  const deleted = await pool.query(
    `DELETE FROM aiva_knowledge_base
     WHERE id = $1 AND worker_id = $2 AND workspace_id = $3
     RETURNING id`,
    [entryId, workerId, req.workspaceId!],
  );
  if (deleted.rows.length === 0) {
    res.status(404).json({ error: 'Entry not found' });
    return;
  }
  res.json({ deleted: true });
});

export { isAiWorkersEnabled, appendKnowledgeToPersona, enforceWorkspaceAccess };

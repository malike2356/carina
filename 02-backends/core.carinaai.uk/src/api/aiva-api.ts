import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  createAutomation,
  createWorker,
  deleteAutomation,
  dismissWorker,
  getAutomation,
  getWorker,
  getWorkerById,
  getWorkerAnalytics,
  listActivity,
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
  setChannelEnabled,
} from '../channels/channel-store.js';
import { registerChannel, unregisterChannel } from '../channels/worker-registry.js';
import { buildCustomPersonaPrompt, buildPersonaPrompt } from '../workers/persona-builder.js';
import { getRoleTemplate, ROLE_TEMPLATES } from '../workers/role-templates.js';
import { parseScheduleText } from '../workers/schedule-parser.js';
import {
  isAiWorkersEnabled,
} from '../workers/aiva-message-handler.js';
import { isPropreneurBridgeEnabled } from '../workers/aiva-feature-flags.js';
import {
  clearPropreneurBinding,
  resolvePropreneurBinding,
  validateAndSetPropreneurBinding,
} from '../workers/worker-bridge-store.js';
import { credentialsConfigured } from '../channels/credential-store.js';
import {
  registerAutomationJob,
  unregisterAutomationJob,
} from '../workers/aiva-automation-scheduler.js';
import {
  getBillingStatus,
  getSubscription,
  getSubscriptionStatus,
  provisionTrial,
} from '../workers/aiva-subscription-store.js';
import { listAivaInvoices } from '../billing/aiva-billing-store.js';
import {
  countWorkers,
  sendAivaCreatedEmail,
  sendWelcomeEmail,
} from '../email/email-triggers.js';
import { upsertWorkspaceContact, aivaAppUrl } from '../email/workspace-contact.js';
import { eraseWorkspaceData, streamWorkspaceExportZip } from '../workers/workspace-gdpr.js';
import { pool } from '../memory/db.js';
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
import { requireBusinessPlan, requireTeamPlan } from '../billing/aiva-plan-middleware.js';
import {
  channelLimitForTier,
  countConnectedChannels,
  resolveWorkspacePlanTier,
} from '../billing/aiva-plan-gates.js';
import {
  createAivaCheckoutSession,
  createAivaPortalSession,
  createAivaSeatCheckoutSession,
} from '../billing/aiva-stripe-checkout.js';
import { getAivaPricingPlans } from '../billing/aiva-pricing.js';
import {
  getDowngradeConflictFields,
  resolveDowngradeConflict,
} from '../billing/aiva-downgrade.js';
import {
  parseChannelBindings,
  provisionWorkerChannels,
  sendHireOnboardingMessages,
} from '../workers/provision-worker-channels.js';

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  slack: 'Slack',
  telegram: 'Telegram',
  web: 'Web chat',
  sms: 'SMS',
  discord: 'Discord',
  teams: 'Microsoft Teams',
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
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function assertCanHireWorker(workspaceId: string): Promise<void> {
  let status = await getSubscriptionStatus(workspaceId);
  if (Number(status.slotLimit) === 0 && Number(status.aivasUsed) === 0) {
    await provisionTrial(workspaceId);
    status = await getSubscriptionStatus(workspaceId);
  }
  if (Number(status.slotLimit) >= 999) {
    return;
  }
  if (status.status === 'suspended') {
    throw new Error('Trial expired. Upgrade your plan to hire more Aivas.');
  }
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

function requireWorkspace(req: AivaRequest, res: Response, next: NextFunction): void {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'AI workers are disabled' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header or body)' });
    return;
  }
  if (!UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Invalid workspaceId' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

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
    });

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

    const workerCount = await countWorkers(workspaceId);
    if (workerCount === 1) {
      void sendAivaCreatedEmail({
        workspaceId,
        workerName: worker.name,
        role: roleDescription,
        workerId: worker.id,
      }).catch((err) => console.error('[aiva-api] aiva created email failed:', err));
    }

    res.status(201).json({ worker });
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
  const workers = await listWorkers(req.workspaceId!);
  res.json({ workers });
});

aivaRouter.get('/workers/:id', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const workerId = routeParam(req.params.id);
  const workspaceId = req.workspaceId!;
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return;
  }

  const [analytics, messagesTodayResult] = await Promise.all([
    getWorkerAnalytics(workerId, workspaceId).catch(() => null),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM ai_worker_activity
       WHERE worker_id = $1 AND created_at >= CURRENT_DATE`,
      [workerId],
    ),
  ]);

  res.json({
    worker: {
      ...worker,
      messagesToday: Number(messagesTodayResult.rows[0]?.count ?? 0),
      totalMessages: analytics?.totalMessages ?? 0,
      escalationRate: analytics?.escalationRate ?? 0,
      automationsRan: analytics?.automationsRunCount ?? 0,
      lastActiveAt: analytics?.lastActiveAt ?? null,
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

    if (existing.status === 'dismissed') {
      res.status(409).json({ error: 'This Aiva was dismissed and cannot be changed' });
      return;
    }

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

    const worker = await updateWorker(req.workspaceId!, workerId, {
      name: roleName,
      roleDescription,
      personaPrompt,
      language: req.body?.language ? String(req.body.language) : undefined,
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
    const hasCredentials = Boolean(row?.credentials.encrypted);
    const connected = type === 'web' ? worker.channels.includes('web') : hasCredentials;
    return {
      id: row?.id ?? type,
      type,
      label: CHANNEL_LABELS[type] ?? type,
      identifier: row?.identifier,
      active: row?.enabled ?? worker.channels.includes(type),
      connected,
      verified: row?.verified ?? false,
    };
  });
  res.json({ channels, planTier, channelLimit, connectedCount });
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
    conversations: result.rows.map((row) => ({
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

  if (resolved.ownerAuto || resolved.linked) {
    await hydrateCanonicalSessionFromLinkedChannels({
      workspaceId,
      workerId,
      canonicalContactId: resolved.canonicalContactId,
      sessionId: resolved.sessionId,
      channel,
      linked: true,
    }).catch(() => ({ hydrated: 0 }));
  }

  if (resolved.ownerAuto && channel === 'web') {
    await mirrorOwnerSharedHistoryIntoWebThread({
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
  res.json(status);
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
  res.json({ plans: await getAivaPricingPlans() });
});

aivaRouter.get('/billing/status', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const status = await getBillingStatus(req.workspaceId!);
  const downgrade = await getDowngradeConflictFields(req.workspaceId!);
  let dunning: unknown = null;
  try {
    const { getActiveDunningCase } = await import('../billing/dunning-store.js');
    const { dunningConfig } = await import('../billing/dunning-engine.js');
    dunning = {
      active: getActiveDunningCase(req.workspaceId!),
      config: dunningConfig(),
      banner: 'Your payment method needs attention; update now to avoid interruption',
    };
  } catch {
    dunning = null;
  }
  res.json({ ...status, ...downgrade, dunning });
});

aivaRouter.get('/billing/dunning/stats', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const { getDunningStats, getAtRiskMRR, predictChurnRisk } = await import('../billing/dunning-stats.js');
  const { dunningConfig } = await import('../billing/dunning-engine.js');
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json({
    stats: getDunningStats({ from, to }),
    atRisk: getAtRiskMRR(),
    churnHints: predictChurnRisk(),
    config: dunningConfig(),
  });
});

aivaRouter.post('/billing/dunning/process-due', requireWorkspace, async (_req: AivaRequest, res: Response) => {
  const { processDueDunning } = await import('../billing/dunning-engine.js');
  const result = await processDueDunning();
  res.json(result);
});

aivaRouter.get('/finance/pnl', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Number(req.query.month) || now.getUTCMonth() + 1;
  const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const { generateMonthlyPnL, renderMonthlyPnLMarkdown } = await import('../finance/index.js');
  const pnl = await generateMonthlyPnL(year, month, { refresh });
  const format = typeof req.query.format === 'string' ? req.query.format : 'json';
  if (format === 'markdown' || format === 'md') {
    res.type('text/markdown').send(renderMonthlyPnLMarkdown(pnl));
    return;
  }
  res.json({ pnl, markdown: renderMonthlyPnLMarkdown(pnl) });
});

aivaRouter.get('/finance/pnl/compare', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Number(req.query.month) || now.getUTCMonth() + 1;
  const prev = new Date(Date.UTC(year, month - 2, 1));
  const { generateMonthlyPnL, compareMonthOverMonth } = await import('../finance/index.js');
  const current = await generateMonthlyPnL(year, month, { refresh: false });
  const previous = await generateMonthlyPnL(prev.getUTCFullYear(), prev.getUTCMonth() + 1, {
    refresh: false,
  });
  res.json({ current, previous, delta: compareMonthOverMonth(current, previous) });
});

aivaRouter.get('/finance/liabilities', requireWorkspace, async (req: AivaRequest, res: Response) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Number(req.query.month) || now.getUTCMonth() + 1;
  const threshold = Number(req.query.threshold ?? 1);
  const { findLiabilityUsers, buildLiabilityAlert, getLastLiabilityAlert } = await import(
    '../finance/index.js'
  );
  res.json({
    liabilities: findLiabilityUsers(threshold, year, month),
    alert: buildLiabilityAlert(year, month) ?? getLastLiabilityAlert(),
  });
});

aivaRouter.post('/finance/pnl/run', requireWorkspace, async (_req: AivaRequest, res: Response) => {
  const { runMonthlyPnLJob } = await import('../finance/index.js');
  const result = await runMonthlyPnLJob();
  res.json(result);
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

aivaRouter.post('/billing/checkout-seat', requireWorkspace, async (req: AivaRequest, res: Response) => {
  try {
    const successUrl = String(req.body?.successUrl ?? `${aivaAppUrl('/billing/aiva')}?checkout=success&seat=1`);
    const cancelUrl = String(req.body?.cancelUrl ?? `${aivaAppUrl('/billing/aiva')}?checkout=cancel`);
    const email = typeof req.body?.email === 'string' ? req.body.email : undefined;
    const quantity = Number(req.body?.quantity ?? 1);
    const session = await createAivaSeatCheckoutSession({
      workspaceId: req.workspaceId!,
      quantity,
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

    if (!name || !description || !scheduleText) {
      res.status(400).json({ error: 'name, description, and scheduleText are required' });
      return;
    }

    const parsed = await parseScheduleText(scheduleText);
    const automation = await createAutomation(workerId, req.workspaceId!, {
      name,
      description,
      cronExpression: parsed.cronExpression,
      scheduleLabel: parsed.scheduleLabel,
    });
    registerAutomationJob(automation.id, automation.cronExpression, automation.timezone);
    res.status(201).json({ automation });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
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
  if (enabled) {
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
  res.json({ templates: ROLE_TEMPLATES });
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
  res.json({
    bound: Boolean(binding),
    tenantSlug: worker.propreneurTenantSlug ?? null,
    summaryEnabled: Boolean(worker.workerConfig?.summary?.enabled),
    summarySchedule: worker.workerConfig?.summary?.summarySchedule ?? null,
  });
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

export { isAiWorkersEnabled, appendKnowledgeToPersona };

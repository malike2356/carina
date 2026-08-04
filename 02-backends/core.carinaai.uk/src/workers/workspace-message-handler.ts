import type { CarinaMessage } from '../types/index.js';
import type { GatewayRouter } from '../gateway/router.js';
import {
  countActivityInWindow,
  countEscalationsInWindow,
  createEscalation,
  getWorkerByChannel,
  logActivity,
} from './worker-store.js';
import { isWorkerIncognito, redactForIncognito } from './incognito.js';
import { getAgentDirective, reportAivaEvent } from './scout-fleet.js';
import {
  aivaEmptyReplyFallback,
  resolveAivaEmptyReplyBucket,
} from './aiva-empty-reply.js';
import {
  applyWorkerSkillPacks,
  getWorkerSessionContext,
  setWorkerSessionContext,
} from './worker-session-context.js';
import { isSkillAllowedForActivePacks } from '../skills/index.js';
import { isPropreneurBridgeEnabled, isPropreneurBridgeWritesEnabled } from './aiva-feature-flags.js';
import { resolvePropreneurBinding } from './worker-bridge-store.js';
import { filterToolsByTier, isToolAllowedForTier } from './workspace-tier-toolsets.js';

const PROPREENEUR_BRIDGE_TOOLS = [
  'propreneur-get-portfolio',
  'propreneur-get-property',
  'propreneur-get-compliance',
  'propreneur-get-deals',
  'propreneur-get-email-activity',
] as const;

const PROPREENEUR_WRITE_TOOLS = [
  'propreneur-propose-deal',
  'propreneur-propose-compliance-update',
  'propreneur-propose-financial-log',
] as const;

const AIVA_WORKSPACE_TOOLS = new Set([
  'workspace-research-create',
  'workspace-research-list',
  'workspace-document-create',
  'workspace-document-list',
  'workspace-inventory',
  'aiva-channel-connect',
  'workspace-channel-list',
  'workspace-channel-connect',
  'workspace-channel-disconnect',
  'workspace-channel-test',
  'workspace-channel-status',
  'workspace-schedule-list',
  'workspace-schedule-create',
  'workspace-schedule-update',
  'workspace-schedule-pause',
  'workspace-schedule-resume',
  'workspace-schedule-delete',
  'workspace-schedule-run-now',
  'workspace-approval-list',
  'workspace-approval-get',
  'workspace-approval-create',
  'workspace-approval-approve',
  'workspace-approval-reject',
  'workspace-approval-modify',
  'workspace-worker-get',
  'workspace-worker-update',
  'workspace-worker-pause',
  'workspace-worker-resume',
  'workspace-worker-skill-enable',
  'workspace-worker-skill-disable',
  'workspace-worker-voice-settings-update',
  'workspace-worker-scout-mode-update',
  'google-drive-list',
  'google-drive-search',
  'google-drive-read',
  'google-drive-create-file',
  'google-drive-update-file',
  'google-drive-create-folder',
  'google-drive-move-file',
  'google-drive-delete-file',
  'google-drive-share-file',
  'companies-house-search-companies',
  'companies-house-search-officers',
  'companies-house-list-officer-appointments',
  'companies-house-get-company',
  'companies-house-list-officers',
  'companies-house-list-psc',
  'gmail-list',
  'gmail-get',
  'gmail-send',
  'google-calendar-list',
  'google-calendar-create',
  'google-calendar-update',
  'google-calendar-delete',
  'google-contacts-list',
  'google-contacts-search',
  'google-sheets-list',
  'google-sheets-append',
  'google-tasks-list',
  'google-tasks-create',
  'trello-list-boards',
  'trello-list-lists',
  'trello-list-cards',
  'trello-create-card',
  // Sales engagement (Outreach) + Soft Wall booking/scheduling.
  // Cold sequence email stays Soft Wall: agents queue drafts; owners approve in Approvals.
  'outreach-discovery-plan',
  'outreach-discovery-sheet-schema',
  'outreach-discovery-normalize-leads',
  'outreach-discovery-ingest-leads',
  'outreach-cadence-summary',
  'outreach-cadence-validate-from',
  'outreach-process-due',
  'outreach-reply-ingest',
  'outreach-reply-review-list',
  'outreach-reply-review-resolve',
  'outreach-booking-config-get',
  'outreach-booking-config-update',
  'outreach-booking-offer-slots',
  'outreach-booking-confirm',
  'outreach-booking-outcome',
  'outreach-booking-reschedule',
  'outreach-booking-cancel',
  'outreach-board-summary',
  'outreach-board-config-get',
  'outreach-board-config-update',
  'outreach-alert-config-get',
  'outreach-alert-config-update',
  'outreach-alert-test',
  'outreach-follow-up-list',
  'outreach-follow-up-run',
  'outreach-control-get',
  'outreach-control-pause',
  'outreach-control-resume',
  'outreach-youtube-import',
  'vical-event-types-list',
  'vical-slots-offer',
  'vical-booking-create',
  'vical-booking-list',
  'vical-booking-cancel',
  'vical-booking-reschedule',
  'vical-booking-config-get',
  'vical-booking-config-update',
  'vical-booking-get',
]);

function holdingMessage(): string {
  return process.env.ESCALATION_HOLDING_MESSAGE
    ?? 'I am checking on this and will get back to you shortly.';
}

function logBlankReplyFallback(input: {
  workerId: string;
  workspaceId: string;
  channel: string;
  contactId: string;
  rawReplyLength: number;
  replyBucket: string;
}): void {
  void reportAivaEvent({
    agentId: input.workerId,
    eventType: 'empty_reply_fallback',
    severity: 'warning',
    summary: `Aiva fallback reply used on ${input.channel}`,
    metadata: {
      workspaceId: input.workspaceId,
      channel: input.channel,
      contactId: input.contactId,
      rawReplyLength: input.rawReplyLength,
      replyBucket: input.replyBucket,
    },
  }).catch(() => {});
}

function workerWorkspaceActionSuffix(): string {
  return [
    '',
    'Workspace action mode: you are an Aiva worker with read/write access to this workspace through tools.',
    'Use workspace-inventory first when the user asks what is in the workspace or asks whether you can see the whole workspace.',
    'When an inventory section is unavailable or returns an error, say exactly which section could not be read.',
    'Use workspace-document-create when the user asks you to create, write, draft, or save a document in the workspace.',
    'Use workspace-research-create when the user asks for deep research and wants it saved in the workspace Research page.',
    'Use workspace-channel-connect when the user provides a Telegram BotFather token or asks you to connect Telegram for this Aiva. Never echo tokens back.',
    'Use worker-automation (or workspace-schedule-* aliases) for recurring digests and cron-like jobs. Do not use host cronjob.',
    'Use workspace-approval-list / get for pending drafts; only approve/reject when the owner clearly asks.',
    'Use workspace-worker-get / update / skill-enable / skill-disable for your own soft settings. Voice credentials and Scout mode stay in the web UI.',
    'Use Google Drive tools when Drive is connected and the user asks you to list, read, create, update, move, delete, or share Drive files.',
    'Sales engagement (Outreach at /aiva/outreach): use outreach-* and vical-* tools to plan discovery, ingest leads, run cadence checks, process due Soft Wall sends, review replies, book discovery calls, and manage follow-ups.',
    'Soft Wall: outreach sequence email is never mass-sent from chat. Call outreach-process-due to queue drafts into Approvals; cold mail only goes out after an owner approves at /aiva/approvals. Prefer workspace-email-draft-for-approval for ad-hoc careful emails.',
    'Never claim a document, research job, channel, schedule, outreach send, or workspace item was saved unless the tool result confirms success.',
    'Never attempt hire/dismiss, billing, OAuth connect, API-key paste, shell, or Scout admin from chat.',
  ].join('\n');
}

export function isAiWorkersEnabled(): boolean {
  return process.env.AI_WORKERS_ENABLED !== 'false';
}

function resolveChannelIdentifier(message: CarinaMessage): { channel: string; identifier: string } | null {
  const channel = message.source;
  const identifier = message.channelUserId ?? message.chatId;
  if (!identifier) return null;
  return { channel, identifier };
}

export async function resolveWorkerForMessage(message: CarinaMessage) {
  if (!isAiWorkersEnabled()) return null;

  const sessionCtx = getWorkerSessionContext(message.sessionId);
  if (sessionCtx?.worker.status === 'active') {
    const directive = await getAgentDirective(sessionCtx.worker.id);
    if (directive.paused) return null;
    return {
      worker: sessionCtx.worker,
      personaPrompt: sessionCtx.personaPrompt,
      channel: message.source,
      channelId: message.chatId ?? message.channelUserId ?? '',
    };
  }

  const resolved = resolveChannelIdentifier(message);
  if (!resolved) return null;
  const worker = await getWorkerByChannel(resolved.channel, resolved.identifier);
  if (!worker || worker.status !== 'active') return null;

  const directive = await getAgentDirective(worker.id);
  if (directive.paused) return null;

  return {
    worker,
    personaPrompt: worker.personaPrompt,
    channel: resolved.channel,
    channelId: resolved.identifier,
  };
}

export function applyWorkerToSession(
  router: GatewayRouter,
  sessionId: string,
  ctx: {
    worker: { id: string; personaPrompt: string; skillPacks: string[] };
    personaPrompt: string;
    planTier?: string;
    channel?: string;
    contactId?: string;
  },
): () => void {
  setWorkerSessionContext(sessionId, {
    worker: ctx.worker as import('../types/index.js').Worker,
    personaPrompt: ctx.personaPrompt,
    planTier: ctx.planTier,
    channel: ctx.channel,
    contactId: ctx.contactId,
  });
  router.setSessionSystemPromptSuffix(
    sessionId,
    `${ctx.personaPrompt}\n${workerWorkspaceActionSuffix()}`.trim(),
  );
  return applyWorkerSkillPacks(sessionId, ctx.worker.skillPacks);
}

export function isToolAllowedForWorker(toolName: string, sessionId: string): boolean {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) return true;

  // Host-wide memory/search/sync/cron must never run under an Aiva worker context.
  if (
    toolName === 'session-search'
    || toolName === 'memory'
    || toolName === 'agent-sync'
    || toolName === 'github-agent-sync'
    || toolName === 'cronjob'
    || toolName === 'research-list'
    || toolName === 'images-gallery'
  ) {
    return false;
  }

  // Messaging DMs must stay text-first. TTS tool replies become MEDIA: paths that
  // Telegram uploads as a generic "Voice reply" audio instead of the answer text.
  if (
    toolName === 'text-to-speech'
    && (ctx.channel === 'telegram' || ctx.channel === 'whatsapp' || ctx.channel === 'sms')
  ) {
    return false;
  }

  if (ctx.planTier && !isToolAllowedForTier(toolName, ctx.planTier)) return false;

  if ((PROPREENEUR_BRIDGE_TOOLS as readonly string[]).includes(toolName)) {
    if (!isPropreneurBridgeEnabled()) return false;
    return Boolean(resolvePropreneurBinding(ctx.worker));
  }

  if ((PROPREENEUR_WRITE_TOOLS as readonly string[]).includes(toolName)) {
    if (!isPropreneurBridgeEnabled() || !isPropreneurBridgeWritesEnabled()) return false;
    return Boolean(resolvePropreneurBinding(ctx.worker));
  }

  if (AIVA_WORKSPACE_TOOLS.has(toolName)) {
    return true;
  }

  if (ctx.worker.skillPacks.length === 0) return true;

  const highRisk = ['shell-exec', 'http-request', 'file-write', 'file-delete'];
  if (highRisk.includes(toolName) && !ctx.worker.skillPacks.includes('core-engineering')) {
    return false;
  }

  return isSkillAllowedForActivePacks(toolName);
}

const ESCALATE_MARKER = '[ESCALATE]';
const toolFailureCounts = new Map<string, { count: number; windowStart: number }>();

async function emitRogueSignals(workerId: string): Promise<void> {
  const [escalations60, messages30, escalations30] = await Promise.all([
    countEscalationsInWindow(workerId, 60),
    countActivityInWindow(workerId, 30, ['message_received', 'message_sent']),
    countActivityInWindow(workerId, 30, ['escalated']),
  ]);

  if (escalations60 >= 3) {
    void reportAivaEvent({
      agentId: workerId,
      eventType: 'escalation_burst',
      severity: 'critical',
      summary: `${escalations60} escalations in 60 minutes`,
      metadata: { workerId },
    }).catch(() => {});
  }

  if (messages30 > 0 && escalations30 / messages30 > 0.4) {
    void reportAivaEvent({
      agentId: workerId,
      eventType: 'high_escalation_rate',
      severity: 'critical',
      summary: `Escalation rate ${Math.round((escalations30 / messages30) * 100)}% in 30 minutes`,
      metadata: { workerId, messages30, escalations30 },
    }).catch(() => {});
  }

  const hourlyAvg = await countActivityInWindow(workerId, 7 * 24 * 60, ['message_received', 'message_sent']);
  const hourlyBaseline = hourlyAvg / (7 * 24);
  const lastHour = await countActivityInWindow(workerId, 60, ['message_received', 'message_sent']);
  if (hourlyBaseline > 0 && lastHour > hourlyBaseline * 3) {
    void reportAivaEvent({
      agentId: workerId,
      eventType: 'volume_spike',
      severity: 'warning',
      summary: `${lastHour} messages in the last hour (baseline ${hourlyBaseline.toFixed(1)}/hr)`,
      metadata: { workerId, lastHour, hourlyBaseline },
    }).catch(() => {});
  }
}

export async function recordUnauthorizedToolAttempt(sessionId: string, toolName: string): Promise<void> {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) return;
  void reportAivaEvent({
    agentId: ctx.worker.id,
    eventType: 'unauthorized_tool_attempt',
    severity: 'critical',
    summary: `Blocked tool: ${toolName}`,
    metadata: { toolName, skillPacks: ctx.worker.skillPacks },
  }).catch(() => {});
}

export function recordToolFailure(sessionId: string, toolName: string): void {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) return;
  const key = `${ctx.worker.id}:${toolName}`;
  const now = Date.now();
  const entry = toolFailureCounts.get(key);
  if (!entry || now - entry.windowStart > 30 * 60 * 1000) {
    toolFailureCounts.set(key, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
  if (entry.count >= 5) {
    void reportAivaEvent({
      agentId: ctx.worker.id,
      eventType: 'tool_failure_loop',
      severity: 'warning',
      summary: `Tool ${toolName} failed ${entry.count} times in 30 minutes`,
      metadata: { toolName },
    }).catch(() => {});
    void import('../memory/aiva/learning-loop.js')
      .then(({ recordAivaToolFailureLesson }) =>
        recordAivaToolFailureLesson({
          workspaceId: ctx.worker.workspaceId,
          workerId: ctx.worker.id,
          toolName,
          sessionId,
          failureCount: entry.count,
        }),
      )
      .catch(() => undefined);
    toolFailureCounts.delete(key);
  }
}

export async function processWorkerInbound(
  ctx: NonNullable<Awaited<ReturnType<typeof resolveWorkerForMessage>>>,
  message: CarinaMessage,
): Promise<void> {
  const incognito = isWorkerIncognito(ctx.worker.workerConfig);
  void logActivity(ctx.worker.id, {
    actionType: 'message_received',
    summary: incognito ? `Inbound ${message.source} message (incognito)` : `Inbound ${message.source} message`,
    inputText: redactForIncognito(incognito, message.content),
    escalated: false,
    channel: ctx.channel,
    contactId: ctx.channelId,
  }).catch(() => {});
  void emitRogueSignals(ctx.worker.id).catch(() => {});
}

export async function processWorkerOutbound(
  ctx: NonNullable<Awaited<ReturnType<typeof resolveWorkerForMessage>>>,
  message: CarinaMessage,
  reply: string,
): Promise<{ reply: string; escalated: boolean }> {
  const hasEscalate = reply.includes(ESCALATE_MARKER);
  const baseReply = reply.replace(ESCALATE_MARKER, '').trim();
  const rawReplyLength = baseReply.length;
  let stripped = baseReply;
  const hold = holdingMessage();
  const incognito = isWorkerIncognito(ctx.worker.workerConfig);

  try {
    const { sanitizeAivaUserFacingReply } = await import('./sanitize-aiva-reply.js');
    stripped = sanitizeAivaUserFacingReply(stripped);
    // Group-chat silence token must never surface in 1:1 Aiva worker chat.
    if (stripped === 'NO_RESPONSE_NEEDED' || !stripped) {
      const replyBucket = resolveAivaEmptyReplyBucket(message.content);
      stripped = aivaEmptyReplyFallback(message.content);
      logBlankReplyFallback({
        workerId: ctx.worker.id,
        workspaceId: ctx.worker.workspaceId,
        channel: ctx.channel,
        contactId: ctx.channelId,
        rawReplyLength,
        replyBucket,
      });
    }
  } catch {
    /* keep stripped as-is if sanitize module fails to load */
    if (stripped === 'NO_RESPONSE_NEEDED' || !stripped) {
      const replyBucket = resolveAivaEmptyReplyBucket(message.content);
      stripped = aivaEmptyReplyFallback(message.content);
      logBlankReplyFallback({
        workerId: ctx.worker.id,
        workspaceId: ctx.worker.workspaceId,
        channel: ctx.channel,
        contactId: ctx.channelId,
        rawReplyLength,
        replyBucket,
      });
    }
  }

  if (hasEscalate) {
    const recentCount = await countEscalationsInWindow(ctx.worker.id, 60);
    if (recentCount >= 2) {
      void reportAivaEvent({
        agentId: ctx.worker.id,
        eventType: 'escalation_burst',
        severity: 'critical',
        summary: `${recentCount + 1} escalations in 60 minutes`,
        metadata: { workerId: ctx.worker.id },
      }).catch(() => {});
    }

    const record = await createEscalation({
      workerId: ctx.worker.id,
      workspaceId: ctx.worker.workspaceId,
      channel: ctx.channel,
      channelId: ctx.channelId,
      originalInput: message.content,
      workerDraft: stripped,
      holdingMessage: hold,
    });

    void reportAivaEvent({
      agentId: ctx.worker.id,
      eventType: 'escalated',
      severity: 'warning',
      summary: incognito
        ? 'Aiva escalated (incognito)'
        : `Aiva escalated: ${message.content.slice(0, 120)}`,
      metadata: { escalationId: record.id, incognito },
    }).catch(() => {});

    void logActivity(ctx.worker.id, {
      actionType: 'escalated',
      summary: 'Message escalated to human review',
      inputText: redactForIncognito(incognito, message.content),
      outputText: redactForIncognito(incognito, stripped),
      escalated: true,
      channel: ctx.channel,
      contactId: ctx.channelId,
    }).catch(() => {});

    return { reply: hold, escalated: true };
  }

  void logActivity(ctx.worker.id, {
    actionType: 'message_sent',
    summary: incognito
      ? `Outbound ${message.source} reply (incognito)`
      : `Outbound ${message.source} reply`,
    inputText: redactForIncognito(incognito, message.content),
    outputText: redactForIncognito(incognito, stripped),
    escalated: false,
    channel: ctx.channel,
    contactId: ctx.channelId,
  }).catch(() => {});

  return { reply: stripped, escalated: false };
}

export { ESCALATE_MARKER, holdingMessage };

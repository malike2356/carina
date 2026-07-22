import type { CarinaMessage } from '../types/index.js';
import type { GatewayRouter } from '../gateway/router.js';
import {
  countActivityInWindow,
  countEscalationsInWindow,
  createEscalation,
  getWorkerByChannel,
  logActivity,
} from './worker-store.js';
import { getAgentDirective, reportAivaEvent } from './scout-fleet.js';
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

function holdingMessage(): string {
  return process.env.ESCALATION_HOLDING_MESSAGE
    ?? 'I am checking on this and will get back to you shortly.';
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
  router.setSessionSystemPromptSuffix(sessionId, ctx.personaPrompt);
  return applyWorkerSkillPacks(sessionId, ctx.worker.skillPacks);
}

export function isToolAllowedForWorker(toolName: string, sessionId: string): boolean {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) return true;

  if (ctx.planTier && !isToolAllowedForTier(toolName, ctx.planTier)) return false;

  if ((PROPREENEUR_BRIDGE_TOOLS as readonly string[]).includes(toolName)) {
    if (!isPropreneurBridgeEnabled()) return false;
    return Boolean(resolvePropreneurBinding(ctx.worker));
  }

  if ((PROPREENEUR_WRITE_TOOLS as readonly string[]).includes(toolName)) {
    if (!isPropreneurBridgeEnabled() || !isPropreneurBridgeWritesEnabled()) return false;
    return Boolean(resolvePropreneurBinding(ctx.worker));
  }

  if (
    toolName === 'workspace-research-create'
    || toolName === 'workspace-research-list'
    || toolName === 'workspace-document-create'
    || toolName === 'workspace-document-list'
  ) {
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
  void logActivity(ctx.worker.id, {
    actionType: 'message_received',
    summary: `Inbound ${message.source} message`,
    inputText: message.content,
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
  let stripped = reply.replace(ESCALATE_MARKER, '').trim();
  const hold = holdingMessage();

  // Group-chat silence token must never surface in 1:1 Aiva worker chat.
  if (stripped === 'NO_RESPONSE_NEEDED') {
    stripped = 'What would you like me to help with?';
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
      summary: `Aiva escalated: ${message.content.slice(0, 120)}`,
      metadata: { escalationId: record.id },
    }).catch(() => {});

    void logActivity(ctx.worker.id, {
      actionType: 'escalated',
      summary: 'Message escalated to human review',
      inputText: message.content,
      outputText: stripped,
      escalated: true,
      channel: ctx.channel,
      contactId: ctx.channelId,
    }).catch(() => {});

    return { reply: hold, escalated: true };
  }

  void logActivity(ctx.worker.id, {
    actionType: 'message_sent',
    summary: `Outbound ${message.source} reply`,
    inputText: message.content,
    outputText: stripped,
    escalated: false,
    channel: ctx.channel,
    contactId: ctx.channelId,
  }).catch(() => {});

  return { reply: stripped, escalated: false };
}

export { ESCALATE_MARKER, holdingMessage };

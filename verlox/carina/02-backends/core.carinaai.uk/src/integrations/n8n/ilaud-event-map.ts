import type { N8nIlaudConfig } from './config.js';

export const ILAUD_N8N_SCOUT_EVENTS = new Set([
  'social_inbound_received',
  'social_approval_requested',
  'social_approval_timeout',
  'social_token_expired',
  'social_post_scheduled',
  'automation_run',
]);

export interface IlaudN8nPayload {
  event: string;
  workerId: string;
  workspaceId: string;
  channel?: string;
  contactId?: string;
  textPreview?: string;
  approvalUrl?: string;
  approvalId?: string;
  automationName?: string;
  messageType?: 'dm' | 'post';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function maskContactId(contactId: string): string {
  const trimmed = contactId.trim();
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function buildIlaudN8nPayload(input: {
  eventType: string;
  workspaceId: string;
  workerId: string;
  config: N8nIlaudConfig;
  metadata?: Record<string, unknown>;
  description?: string;
}): IlaudN8nPayload | null {
  if (!ILAUD_N8N_SCOUT_EVENTS.has(input.eventType)) return null;

  if (input.eventType === 'automation_run') {
    const meta = input.metadata ?? {};
    const isSocialAutomation =
      meta.messageType === 'post'
      || (typeof meta.automationName === 'string' && /social|linkedin|instagram|post/i.test(meta.automationName));
    if (!isSocialAutomation) return null;
  }

  const channel = input.metadata?.channel ? String(input.metadata.channel) : undefined;
  const contactId = input.metadata?.contactId ? String(input.metadata.contactId) : undefined;
  const textSource =
    input.metadata?.textPreview
    ?? input.metadata?.inboundText
    ?? input.metadata?.draftText
    ?? input.description
    ?? '';
  const textPreview = String(textSource).slice(0, 200);
  const messageType = input.metadata?.messageType === 'post' ? 'post' : 'dm';

  return {
    event: input.eventType,
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    channel,
    contactId: contactId ? maskContactId(contactId) : undefined,
    textPreview: textPreview || undefined,
    approvalUrl: `${input.config.approvalBaseUrl}/aiva/approvals?tab=social`,
    approvalId: input.metadata?.approvalId ? String(input.metadata.approvalId) : undefined,
    automationName: input.metadata?.automationName
      ? String(input.metadata.automationName)
      : undefined,
    messageType,
    timestamp: new Date().toISOString(),
    metadata: input.metadata,
  };
}

export function resolveN8nWebhookUrl(
  eventType: string,
  config: N8nIlaudConfig,
): string | null {
  if (eventType === 'social_token_expired') {
    return config.tokenHealthWebhookUrl || config.engagementWebhookUrl || null;
  }
  if (eventType === 'social_post_scheduled') {
    return config.postWebhookUrl || config.engagementWebhookUrl || null;
  }
  return config.engagementWebhookUrl || null;
}

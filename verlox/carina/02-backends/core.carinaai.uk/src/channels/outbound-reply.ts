import type { InboundMessage, AivaChannelName } from './types.js';
import { getThreadEmailSubject } from './channel-store.js';
import { getRegistryCredentials, type RegistryEntry } from './worker-registry.js';
import { getAdapter } from './adapter-registry.js';
import { createEscalation, logActivity } from '../workers/worker-store.js';
import { WhatsApp24hWindowError } from './adapters/whatsapp-adapter.js';
import { buildEmailReplyHeaders } from './adapters/email-adapter.js';
import { logChannelScoutSignal } from './channel-scout-signals.js';
import { enforceConnectorResourceScope } from '../security/connector-resource-scopes.js';

function channelToConnector(channel: AivaChannelName): string | null {
  if (channel === 'slack') return 'slack';
  if (channel === 'email') return 'email';
  if (channel === 'instagram' || channel === 'messenger') return 'meta';
  if (channel === 'linkedin') return 'linkedin';
  if (channel === 'twitter') return 'twitter';
  if (channel === 'tiktok') return 'tiktok';
  return null;
}

function resourceKindForConnector(connector: string): string {
  if (connector === 'email') return 'mailboxes';
  if (connector === 'meta') return 'pages';
  if (connector === 'slack') return 'channels';
  return 'accounts';
}

export async function sendOutboundReply(
  channel: AivaChannelName,
  entry: RegistryEntry,
  inbound: InboundMessage,
  response: string,
): Promise<void> {
  const adapter = getAdapter(channel);
  if (!adapter) return;

  const connector = channelToConnector(channel);
  if (connector) {
    const resourceId = String(
      inbound.conversationId
        ?? inbound.threadId
        ?? inbound.contactId
        ?? '',
    ).trim();
    const scope = await enforceConnectorResourceScope({
      workspaceId: entry.workspaceId,
      workerId: entry.workerId,
      connector,
      action: 'write',
      refs: resourceId
        ? [{ kind: resourceKindForConnector(connector), id: resourceId }]
        : [],
      actor: `worker:${entry.workerId}`,
    });
    if (!scope.allowed) {
      logChannelScoutSignal({
        workerId: entry.workerId,
        eventType: 'connector_scope_denied',
        severity: 'warning',
        description: scope.reason ?? 'Outbound blocked by resource scope',
        metadata: { channel, code: scope.code, target: scope.target, workspaceId: entry.workspaceId },
      });
      return;
    }
  }

  const credentials = getRegistryCredentials(entry);
  try {
    let replySubject = 'Re: your message';
    let emailReplyHeaders: { inReplyTo?: string; references?: string } = {};
    if (channel === 'email') {
      const inboundPayload = inbound.rawPayload as {
        Subject?: string;
        MessageID?: string;
        Headers?: Array<{ Name: string; Value: string }>;
      };
      const inboundSubject = inboundPayload.Subject?.trim();
      if (inboundSubject) {
        replySubject = /^re:/i.test(inboundSubject) ? inboundSubject : `Re: ${inboundSubject}`;
      } else {
        const stored = await getThreadEmailSubject(entry.workerId, channel, inbound.contactId);
        if (stored) {
          replySubject = /^re:/i.test(stored) ? stored : `Re: ${stored}`;
        }
      }
      emailReplyHeaders = buildEmailReplyHeaders(inboundPayload);
    }

    await adapter.send(
      {
        channel,
        contactId: inbound.contactId,
        content: response,
        replyToThreadId: emailReplyHeaders.inReplyTo ?? inbound.threadId,
        metadata: channel === 'email'
          ? {
              subject: replySubject,
              ...(emailReplyHeaders.references ? { references: emailReplyHeaders.references } : {}),
            }
          : inbound.conversationId
            ? { conversationId: inbound.conversationId }
            : undefined,
      },
      credentials,
    );
  } catch (err) {
    if (err instanceof WhatsApp24hWindowError) {
      await createEscalation({
        workerId: entry.workerId,
        workspaceId: entry.workspaceId,
        channel,
        channelId: inbound.contactId,
        originalInput: inbound.content,
        workerDraft: response,
        holdingMessage: 'WhatsApp 24-hour reply window expired; a human will follow up.',
      });
      logChannelScoutSignal({
        workerId: entry.workerId,
        eventType: 'channel_window_expired',
        severity: 'info',
        description: `WhatsApp 24h window expired for ${inbound.contactId}`,
        metadata: { channel: 'whatsapp', contactId: inbound.contactId },
      });
      void logActivity(entry.workerId, {
        actionType: 'escalated',
        summary: `WhatsApp 24h window expired for ${inbound.contactId}`,
        inputText: inbound.content,
        escalated: true,
        channel,
        contactId: inbound.contactId,
      }).catch(() => {});
      return;
    }
    if (channel === 'whatsapp') {
      logChannelScoutSignal({
        workerId: entry.workerId,
        eventType: 'channel_send_failed',
        severity: 'warning',
        description: err instanceof Error ? err.message : String(err),
        metadata: { channel: 'whatsapp', contactId: inbound.contactId },
      });
    }
    throw err;
  }
}

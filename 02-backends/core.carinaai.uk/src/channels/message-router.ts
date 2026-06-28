import type { InboundMessage, AivaChannelName } from './types.js';
import { upsertThread, markChannelVerified, getThreadEmailSubject } from './channel-store.js';
import { getRegistryCredentials, lookupWorker } from './worker-registry.js';
import { getAdapter } from './adapter-registry.js';
import { processAivaMessage } from '../workers/aiva-process-message.js';
import { createEscalation, logActivity } from '../workers/worker-store.js';
import { WhatsApp24hWindowError } from './adapters/whatsapp-adapter.js';
import { buildEmailReplyHeaders } from './adapters/email-adapter.js';
import { pool } from '../memory/db.js';
import { checkAndEnforceLimit, incrementMessageCount, maybeSendUsageAlerts } from '../usage/usage-service.js';
import { logChannelScoutSignal } from './channel-scout-signals.js';

const LIMIT_REPLY = 'This workspace has reached its monthly message limit. Please upgrade your plan to continue.';

export async function routeInboundMessage(
  channel: AivaChannelName,
  identifier: string,
  buildMessage: (workerId: string, workspaceId: string) => InboundMessage | null,
): Promise<{ handled: boolean; response?: string; entry?: ReturnType<typeof lookupWorker> }> {
  const entry = lookupWorker(channel, identifier);
  if (!entry) {
    console.warn(`[channel-router] No Aiva found for ${channel}:${identifier}`);
    return { handled: false };
  }

  const message = buildMessage(entry.workerId, entry.workspaceId);
  if (!message) return { handled: false, entry };

  const overrideResult = await pool.query(
    `SELECT va_override FROM channel_threads
     WHERE worker_id = $1 AND contact_id = $2 AND channel = $3
     LIMIT 1`,
    [entry.workerId, message.contactId, message.channel],
  );
  if (Boolean(overrideResult.rows[0]?.va_override)) {
    return { handled: true, response: undefined, entry };
  }

  const limitCheck = await checkAndEnforceLimit(entry.workspaceId);
  if (!limitCheck.allowed) {
    void maybeSendUsageAlerts(entry.workspaceId).catch(() => {});
    return { handled: true, response: LIMIT_REPLY, entry };
  }

  await upsertThread({
    workerId: entry.workerId,
    workspaceId: entry.workspaceId,
    channel: message.channel,
    contactId: message.contactId,
    threadId: message.threadId,
    preview: message.content,
    emailSubject:
      message.channel === 'email'
        ? String((message.rawPayload as { Subject?: string })?.Subject ?? '').trim() || undefined
        : undefined,
  });

  const response = await processAivaMessage({
    workerId: entry.workerId,
    workspaceId: entry.workspaceId,
    userMessage: message.content,
    channel: message.channel,
    contactId: message.contactId,
    threadId: message.threadId,
    contactName: message.contactName,
  });

  if (response) {
    await incrementMessageCount(entry.workspaceId);
    void maybeSendUsageAlerts(entry.workspaceId).catch(() => {});
  }

  return { handled: true, response, entry };
}

export async function sendOutboundReply(
  channel: AivaChannelName,
  entry: NonNullable<ReturnType<typeof lookupWorker>>,
  inbound: InboundMessage,
  response: string,
): Promise<void> {
  const adapter = getAdapter(channel);
  if (!adapter) return;

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

export async function handleParsedInbound(message: InboundMessage, identifier: string): Promise<void> {
  const result = await routeInboundMessage(message.channel, identifier, () => message);
  if (result.handled && result.response && result.entry) {
    await sendOutboundReply(message.channel, result.entry, message, result.response);
    if (result.entry.channelRowId) {
      void markChannelVerified(result.entry.channelRowId).catch(() => {});
    }
  }
}

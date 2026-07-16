import React from 'react';
import { sendEmail } from '../../email/email-service.js';
import { PlainEmailTemplate } from '../../email/templates/plain-email.js';
import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';

interface PostmarkInboundPayload {
  From?: string;
  FromFull?: { Email?: string; Name?: string };
  To?: string;
  ToFull?: Array<{ Email?: string }>;
  Subject?: string;
  TextBody?: string;
  MessageID?: string;
  Headers?: Array<{ Name: string; Value: string }>;
}

function headerValue(
  headers: Array<{ Name: string; Value: string }> | undefined,
  name: string,
): string | undefined {
  return headers?.find((h) => h.Name.toLowerCase() === name.toLowerCase())?.Value?.trim();
}

export function stripQuotedReply(text: string): string {
  const lines = text.split('\n');
  const cleaned: string[] = [];
  for (const line of lines) {
    if (/^On .+ wrote:$/i.test(line.trim())) break;
    if (/^>{1,2}\s/.test(line)) continue;
    if (/^From:/i.test(line) && cleaned.length > 0) break;
    cleaned.push(line);
  }
  return cleaned.join('\n').trim();
}

function buildReplySubject(raw?: string, isFirstContact?: boolean): string {
  const subject = raw?.trim();
  if (!subject) return isFirstContact ? 'Hello from your AI assistant' : 'Re: your message';
  if (isFirstContact) return subject;
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

export function buildEmailReplyHeaders(payload: PostmarkInboundPayload): {
  inReplyTo?: string;
  references?: string;
} {
  const messageId = payload.MessageID?.trim();
  if (!messageId) return {};
  const priorReferences = headerValue(payload.Headers, 'references');
  const references = priorReferences ? `${priorReferences} ${messageId}` : messageId;
  return { inReplyTo: messageId, references };
}

export const emailAdapter: ChannelAdapter = {
  channel: 'email',

  verify(headers) {
    const token = process.env.POSTMARK_INBOUND_WEBHOOK_TOKEN?.trim();
    if (!token) return process.env.NODE_ENV !== 'production';
    const provided = headers['x-postmark-inbound-token']
      ?? headers['x-postmark-token']
      ?? headers['x-email-channel-secret']
      ?? '';
    return provided === token;
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const body = payload as PostmarkInboundPayload;
    const from = (body.FromFull?.Email ?? body.From ?? '').trim().toLowerCase();
    const text = stripQuotedReply(String(body.TextBody ?? '').trim());
    if (!from || !text) return null;

    const inReplyTo = headerValue(body.Headers, 'in-reply-to');
    const messageId = body.MessageID?.trim();

    return {
      channel: 'email',
      workerId,
      workspaceId,
      contactId: from,
      contactName: body.FromFull?.Name,
      content: text,
      rawPayload: payload,
      timestamp: new Date(),
      threadId: inReplyTo ?? messageId,
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const replyTo = credentials.from_address ?? credentials.identifier;
    if (!replyTo) throw new Error('Email channel missing from_address');

    const isFirstContact = !message.replyToThreadId && Boolean(message.metadata?.isFirstContact);
    const subject = buildReplySubject(
      typeof message.metadata?.subject === 'string' ? message.metadata.subject : undefined,
      isFirstContact,
    );
    const workerName = credentials.worker_name?.trim() || undefined;
    const inReplyTo = message.replyToThreadId?.trim();
    const references = message.metadata?.references?.trim() || inReplyTo;

    await sendEmail({
      to: message.contactId,
      subject,
      template: React.createElement(PlainEmailTemplate, {
        content: message.content,
        workerName,
      }),
      replyTo,
      headers: inReplyTo
        ? {
            'In-Reply-To': inReplyTo,
            ...(references ? { References: references } : {}),
          }
        : undefined,
      tags: [{ name: 'channel', value: 'aiva-email' }],
      transactional: true,
    });
  },
};

export function extractEmailRecipient(payload: unknown): string | null {
  const body = payload as PostmarkInboundPayload;
  const to = body.ToFull?.[0]?.Email ?? body.To ?? '';
  return to ? to.toLowerCase() : null;
}

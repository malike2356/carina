import twilio from 'twilio';
import { sendTwilioSms } from '@verlox/carina-transport';
import type { ChannelAdapter, InboundMessage, OutboundMessage } from '../types.js';

interface TwilioSmsPayload {
  From?: string;
  To?: string;
  Body?: string;
  MessageSid?: string;
}

export function normalizeSmsNumber(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `+${digits}` : trimmed;
}

export function extractSmsToNumber(payload: unknown): string | null {
  const body = payload as TwilioSmsPayload;
  const to = String(body.To ?? '').trim();
  return to ? normalizeSmsNumber(to) : null;
}

export const smsAdapter: ChannelAdapter = {
  channel: 'sms',

  verify(headers, _rawBody, credentials) {
    const signature = headers['x-twilio-signature'];
    const authToken = credentials?.auth_token?.trim();
    const url = credentials?.webhook_url?.trim();
    if (!signature || !authToken || !url) {
      return process.env.NODE_ENV !== 'production';
    }
    try {
      return twilio.validateRequest(
        authToken,
        signature,
        url,
        parseTwilioBody(_rawBody),
      );
    } catch {
      return false;
    }
  },

  parse(payload, workerId, workspaceId): InboundMessage | null {
    const body = payload as TwilioSmsPayload;
    const from = String(body.From ?? '').trim();
    const text = String(body.Body ?? '').trim();
    if (!from || !text) return null;

    return {
      channel: 'sms',
      workerId,
      workspaceId,
      contactId: normalizeSmsNumber(from),
      content: text,
      rawPayload: payload,
      timestamp: new Date(),
      threadId: body.MessageSid,
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const accountSid = credentials.account_sid?.trim();
    const authToken = credentials.auth_token?.trim();
    const from = credentials.from_number?.trim();
    if (!accountSid || !authToken || !from) {
      throw new Error('SMS credentials missing account_sid, auth_token, or from_number');
    }

    await sendTwilioSms({
      accountSid,
      authToken,
      from: normalizeSmsNumber(from),
      to: normalizeSmsNumber(message.contactId),
      body: message.content,
    });
  },
};

function parseTwilioBody(rawBody: Buffer): Record<string, string> {
  const text = rawBody.toString();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

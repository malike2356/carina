import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  findHostedEmailAddressByRecipient,
  normalizeEmailRecipient,
  recordHostedEmailInbound,
  type HostedEmailAddress,
} from './hosted-email-address.js';
import { categorizeEmail, categoryLabel } from './email-categorizer.js';
import { parseEmailDigest } from './email-parser.js';
import { createDraftApprovalForEmail } from './email-draft-handler.js';
import {
  digestExists,
  getEmailConnection,
  listSenders,
  saveDigest,
} from './email-connection-store.js';
import { getWorkerById, logActivity } from '../../workers/worker-store.js';

export type MailgunInboundFields = {
  recipient: string;
  sender: string;
  from: string;
  subject: string;
  bodyPlain: string;
  bodyHtml: string;
  messageId: string;
  timestamp: string;
  token: string;
  signature: string;
  attachmentCount: number;
};

export type ProcessMailgunResult =
  | { status: 'accepted'; workspaceId: string; workerId: string; digestId?: string }
  | { status: 'ignored'; reason: string }
  | { status: 'blocked'; reason: string }
  | { status: 'unauthorized' }
  | { status: 'error'; reason: string };

export type HostedEmailInboundSource = 'hosted-mailgun' | 'hosted-cloudflare' | 'hosted-test';

const MAX_SIGNATURE_AGE_SEC = 15 * 60;

function field(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

export function parseMailgunInboundPayload(body: Record<string, unknown>): MailgunInboundFields {
  const attachmentCountRaw = field(body, 'attachment-count', 'attachment_count');
  const attachmentCount = Number.parseInt(attachmentCountRaw || '0', 10);
  return {
    recipient: field(body, 'recipient', 'To', 'to'),
    sender: field(body, 'sender'),
    from: field(body, 'from', 'From'),
    subject: field(body, 'subject', 'Subject'),
    bodyPlain: field(body, 'body-plain', 'body_plain', 'stripped-text', 'text'),
    bodyHtml: field(body, 'body-html', 'body_html', 'stripped-html', 'html'),
    messageId: field(body, 'Message-Id', 'Message-ID', 'message-id', 'message_id'),
    timestamp: field(body, 'timestamp'),
    token: field(body, 'token'),
    signature: field(body, 'signature'),
    attachmentCount: Number.isFinite(attachmentCount) ? attachmentCount : 0,
  };
}

export function mailgunSigningKey(): string {
  return process.env.MAILGUN_WEBHOOK_SIGNING_KEY?.trim() ?? '';
}

export function isMailgunSignatureRequired(): boolean {
  if (process.env.MAILGUN_WEBHOOK_REQUIRE_SIGNATURE === 'false') return false;
  if (mailgunSigningKey()) return true;
  return process.env.NODE_ENV === 'production';
}

export function verifyMailgunWebhookSignature(input: {
  timestamp: string;
  token: string;
  signature: string;
  signingKey?: string;
  nowSec?: number;
}): boolean {
  const key = input.signingKey ?? mailgunSigningKey();
  if (!key) return false;
  if (!input.timestamp || !input.token || !input.signature) return false;
  if (!/^\d+$/.test(input.timestamp)) return false;

  const ts = Number.parseInt(input.timestamp, 10);
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SIGNATURE_AGE_SEC) return false;

  const expected = createHmac('sha256', key)
    .update(`${input.timestamp}${input.token}`)
    .digest('hex');

  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(input.signature, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function resolveFromAddress(fields: MailgunInboundFields): string {
  return (
    normalizeEmailRecipient(fields.from)
    || normalizeEmailRecipient(fields.sender)
    || fields.from.toLowerCase()
    || fields.sender.toLowerCase()
  );
}

async function isSenderAllowed(
  workerId: string,
  fromAddress: string,
): Promise<{ allowed: boolean; roleTag: string | null }> {
  const connection = await getEmailConnection(workerId);
  if (!connection) return { allowed: true, roleTag: null };

  const senders = await listSenders(connection.id);
  if (senders.length === 0) return { allowed: true, roleTag: null };

  const from = fromAddress.trim().toLowerCase();
  const domain = from.includes('@') ? `@${from.split('@')[1]}` : '';
  for (const sender of senders) {
    const allowed = sender.emailAddress.trim().toLowerCase();
    if (allowed === from || (domain && allowed === domain)) {
      return { allowed: true, roleTag: sender.roleTag || null };
    }
  }
  return { allowed: false, roleTag: null };
}

function resolveAppBaseUrl(): string {
  return (
    process.env.AIVA_APP_PUBLIC_URL
    ?? process.env.AIVA_APP_URL
    ?? process.env.CARINA_HOSTED_APP_URL
    ?? 'https://admin.hireaiva.co.uk'
  )
    .trim()
    .replace(/\/$/, '');
}

async function pushToWorkspaceEmailStore(input: {
  workspaceId: string;
  workerId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  messageId: string;
}): Promise<void> {
  const key = process.env.CARINA_INTERNAL_KEY?.trim();
  if (!key) return;

  const preview = input.body.slice(0, 500);
  try {
    await fetch(`${resolveAppBaseUrl()}/api/internal/email/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-key': key,
      },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        workerId: input.workerId,
        fromAddress: input.from,
        toAddress: input.to,
        subject: input.subject || '(no subject)',
        bodyPreview: preview,
        bodyFull: input.body,
        externalId: input.messageId || null,
        source: 'aiva-hosted',
        status: 'inbox',
        urgency: 'normal',
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.warn(
      '[hosted-email] workspace email store push failed:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function processMailgunInbound(
  body: Record<string, unknown>,
  options: {
    skipSignature?: boolean;
    source?: HostedEmailInboundSource;
    messageIdPrefix?: string;
  } = {},
): Promise<ProcessMailgunResult> {
  const fields = parseMailgunInboundPayload(body);

  if (!options.skipSignature) {
    if (isMailgunSignatureRequired()) {
      const ok = verifyMailgunWebhookSignature({
        timestamp: fields.timestamp,
        token: fields.token,
        signature: fields.signature,
      });
      if (!ok) return { status: 'unauthorized' };
    }
  }

  const recipient = normalizeEmailRecipient(fields.recipient);
  if (!recipient) {
    recordHostedEmailInbound({ accepted: false });
    return { status: 'ignored', reason: 'missing_recipient' };
  }

  let mapped: HostedEmailAddress | null = null;
  try {
    mapped = await findHostedEmailAddressByRecipient(recipient);
  } catch (err) {
    return {
      status: 'error',
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  if (!mapped) {
    recordHostedEmailInbound({ accepted: false, recipient });
    console.info('[hosted-email] ignored unknown recipient', { recipient });
    return { status: 'ignored', reason: 'unknown_recipient' };
  }

  const from = resolveFromAddress(fields);
  if (!from) {
    recordHostedEmailInbound({ accepted: false, recipient });
    return { status: 'ignored', reason: 'missing_from' };
  }

  const bodyText = fields.bodyPlain || fields.bodyHtml.replace(/<[^>]+>/g, ' ').trim();
  const messageId =
    fields.messageId
    || `${options.messageIdPrefix ?? 'mailgun'}-${fields.timestamp || Date.now()}-${Buffer.from(recipient).toString('base64url').slice(0, 12)}`;

  const senderPolicy = await isSenderAllowed(mapped.workerId, from);
  if (!senderPolicy.allowed) {
    recordHostedEmailInbound({ accepted: false, recipient });
    console.info('[hosted-email] blocked by sender policy', {
      workerId: mapped.workerId,
      from,
    });
    return { status: 'blocked', reason: 'sender_not_allowed' };
  }

  if (await digestExists(mapped.workerId, messageId)) {
    recordHostedEmailInbound({ accepted: true, recipient });
    return {
      status: 'accepted',
      workspaceId: mapped.workspaceId,
      workerId: mapped.workerId,
    };
  }

  const worker = await getWorkerById(mapped.workerId);
  if (!worker) {
    recordHostedEmailInbound({ accepted: false, recipient });
    return { status: 'ignored', reason: 'worker_missing' };
  }

  const digest = parseEmailDigest({
    from,
    subject: fields.subject,
    body: bodyText,
    roleTag: senderPolicy.roleTag,
  });
  const category = categorizeEmail({
    from,
    subject: fields.subject,
    body: bodyText,
    roleTag: senderPolicy.roleTag,
  });

  const digestId = await saveDigest(
    mapped.workerId,
    messageId,
    from,
    senderPolicy.roleTag,
    digest,
    category,
  );

  void logActivity(mapped.workerId, {
    actionType: 'automation_run',
    summary: `Email received (${categoryLabel(category)}): ${fields.subject || from}`,
    inputText: digest.summary,
    escalated: false,
    channel: 'email',
  }).catch(() => {});

  void createDraftApprovalForEmail({
    workerId: mapped.workerId,
    workspaceId: mapped.workspaceId,
    digestId,
    messageId,
    from,
    subject: fields.subject,
    body: bodyText,
    category,
  }).catch((draftErr) => {
    const message = draftErr instanceof Error ? draftErr.message : String(draftErr);
    console.warn(`[hosted-email] draft approval skipped for ${mapped!.workerId}: ${message}`);
  });

  void import('../../outreach/inbound/ingest.js')
    .then(({ ingestRawInbound }) => ingestRawInbound({
      workspaceId: mapped.workspaceId,
      workerId: mapped.workerId,
      provider: options.source === 'hosted-cloudflare' ? 'cloudflare' : 'mailgun',
      providerMessageId: messageId,
      from,
      to: recipient,
      subject: fields.subject || '(no subject)',
      textBody: bodyText,
      htmlBody: fields.bodyHtml || undefined,
      receivedAt: fields.timestamp
        ? new Date(Number(fields.timestamp) * 1000)
        : new Date(),
    }))
    .catch((ingestErr) => {
      const message = ingestErr instanceof Error ? ingestErr.message : String(ingestErr);
      console.warn(`[hosted-email] outreach ingest skipped for ${mapped!.workerId}: ${message}`);
    });

  void (async () => {
    const { onWorkerInboundEvent } = await import('../../workers/worker-playbook-triggers.js');
    await onWorkerInboundEvent(mapped!.workerId, {
      type: 'email_received',
      payload: {
        subject: fields.subject,
        from,
        body_preview: digest.summary,
        category,
        source: options.source ?? 'hosted-mailgun',
      },
    });
  })().catch((triggerErr) => {
    const message = triggerErr instanceof Error ? triggerErr.message : String(triggerErr);
    console.warn(`[hosted-email] playbook trigger skipped: ${message}`);
  });

  void pushToWorkspaceEmailStore({
    workspaceId: mapped.workspaceId,
    workerId: mapped.workerId,
    from,
    to: mapped.address,
    subject: fields.subject,
    body: bodyText,
    messageId,
  });

  recordHostedEmailInbound({ accepted: true, recipient });
  console.info('[hosted-email] accepted inbound', {
    workerId: mapped.workerId,
    workspaceId: mapped.workspaceId,
    recipient,
    attachmentCount: fields.attachmentCount,
  });

  return {
    status: 'accepted',
    workspaceId: mapped.workspaceId,
    workerId: mapped.workerId,
    digestId,
  };
}

/** Non-production test helper: simulate an inbound without Mailgun. */
export async function simulateHostedInboundTest(input: {
  workspaceId: string;
  workerId: string;
  address: string;
}): Promise<ProcessMailgunResult> {
  if (process.env.NODE_ENV === 'production') {
    return { status: 'error', reason: 'simulated_inbound_disabled_in_production' };
  }

  return processMailgunInbound(
    {
      recipient: input.address,
      sender: 'test@example.com',
      from: 'Aiva Test <test@example.com>',
      subject: 'Test email for your Aiva',
      'body-plain':
        'This is a safe test message created from the Aiva detail page. You can ignore it.',
      'Message-Id': `<aiva-test-${Date.now()}@localhost.invalid>`,
      timestamp: String(Math.floor(Date.now() / 1000)),
      token: 'test-token',
      signature: 'test-signature',
    },
    { skipSignature: true, source: 'hosted-test', messageIdPrefix: 'test' },
  );
}

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { getRedis } from '../../event-server/redis.js';
import type { ControlMetadata } from '../../messaging/control.js';
import { createChannelLinkService } from '../../messaging/channel-links.js';

type WhatsAppTextMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  text?: { body?: string } | string;
};

type WhatsAppContact = {
  wa_id?: string;
  profile?: { name?: string };
};

type WhatsAppValue = {
  messaging_product?: string;
  metadata?: { phone_number_id?: string };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppTextMessage[];
  statuses?: Array<Record<string, unknown>>;
};

type WhatsAppChange = {
  field?: string;
  value?: WhatsAppValue;
};

type WhatsAppEntry = {
  id?: string;
  changes?: WhatsAppChange[];
};

type WhatsAppWebhook = {
  object?: string;
  entry?: WhatsAppEntry[];
};

interface PendingConfirmation {
  organizationId: string;
  command: string;
  args: string[];
  channelUserRef: string;
  displayRef: string;
  dashboardUserId: string;
  reason: string | null;
  chatRef: string | null;
}

const PENDING_PREFIX = 'scout:whatsapp:confirm:';
const PENDING_TTL_SECONDS = 30;
const pendingConfirmations = new Map<string, { state: PendingConfirmation; expiresAt: number }>();

function rawBody(req: Request): string {
  return (req as Request & { rawBody?: string }).rawBody ?? '';
}

function parseString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizePhoneRef(value: string): string {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? `+${digits}` : value.trim();
}

function whatsappApiRecipient(value: string): string {
  return value.replace(/[^\d]/g, '');
}

function whatsappCommand(text: string): string {
  const first = text.trim().split(/\s+/)[0] ?? '';
  const stripped = first.startsWith('/') ? first.slice(1) : first;
  return stripped.toLowerCase();
}

function whatsappArgs(text: string): string[] {
  return text.trim().split(/\s+/).slice(1);
}

function whatsappDisplayName(contact?: WhatsAppContact, fallback = ''): string {
  return parseString(contact?.profile?.name) || fallback;
}

function featureEnabled(): boolean {
  return (process.env.SCOUT_WHATSAPP_ENABLED ?? 'false').toLowerCase() === 'true';
}

function verifySecretHeader(req: Request): boolean {
  const expected = process.env.WHATSAPP_APP_SECRET?.trim() || '';
  if (!expected) return false;

  const provided = req.header('X-Hub-Signature-256')?.trim() || '';
  if (!provided.startsWith('sha256=')) return false;

  const payload = rawBody(req);
  if (!payload) return false;

  const actual = crypto
    .createHmac('sha256', expected)
    .update(payload)
    .digest('hex');

  const incoming = provided.slice('sha256='.length);
  if (incoming.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(incoming), Buffer.from(actual));
}

function verifyTokenChallenge(req: Request, res: Response): boolean {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim()
    || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()
    || '';
  const mode = parseString(req.query['hub.mode']);
  const token = parseString(req.query['hub.verify_token']);
  const challenge = parseString(req.query['hub.challenge']);

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    res.status(200).send(challenge);
    return true;
  }

  res.status(403).json({ error: 'Webhook verification failed' });
  return false;
}

async function setPendingConfirmation(state: PendingConfirmation): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.setex(`${PENDING_PREFIX}${state.channelUserRef}`, PENDING_TTL_SECONDS, JSON.stringify(state));
    return;
  }
  pendingConfirmations.set(state.channelUserRef, {
    state,
    expiresAt: Date.now() + PENDING_TTL_SECONDS * 1000,
  });
}

async function getPendingConfirmation(channelUserRef: string): Promise<PendingConfirmation | null> {
  const redis = getRedis();
  if (redis) {
    const payload = await redis.get(`${PENDING_PREFIX}${channelUserRef}`);
    return payload ? parseJson<PendingConfirmation>(payload) : null;
  }

  const entry = pendingConfirmations.get(channelUserRef);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pendingConfirmations.delete(channelUserRef);
    return null;
  }
  return entry.state;
}

async function clearPendingConfirmation(channelUserRef: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(`${PENDING_PREFIX}${channelUserRef}`);
    return;
  }
  pendingConfirmations.delete(channelUserRef);
}

async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN?.trim() || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  if (!token || !phoneNumberId || !to) return;

  try {
    await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: whatsappApiRecipient(to),
        type: 'text',
        text: { body },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-engine:whatsapp] send failed:', msg);
  }
}

async function getLinkService() {
  const { pool } = await import('../../event-server/db.js');
  return createChannelLinkService({
    pool,
    now: () => new Date(),
  });
}

function buildMetadata(state: PendingConfirmation, command: string): ControlMetadata {
  return {
    organizationId: state.organizationId,
    dashboardUserId: state.dashboardUserId,
    channel: 'whatsapp',
    channelUserRef: state.channelUserRef,
    chatRef: state.chatRef ?? undefined,
    command,
    reason: state.reason ?? command,
    source: 'whatsapp',
    actor: state.displayRef,
    confirmed: true,
    plan: process.env.SCOUT_OPERATOR_PLAN?.trim() || 'enterprise',
  };
}

async function runControlAction(state: PendingConfirmation, command: string, args: string[]): Promise<{ ok: true; text: string } | { ok: false; text: string; code?: string }> {
  const { getControlService } = await import('../../messaging/control-defaults.js');
  const control = getControlService();
  const meta = buildMetadata(state, command);

  if (command === 'status') {
    const status = await control.getStatus(state.organizationId);
    const agents = status.agents as Record<string, unknown> | undefined;
    return {
      ok: true,
      text: `Status: active=${Number(agents?.active ?? 0)}, suspended=${Number(agents?.suspended ?? 0)}, offline=${Number(agents?.offline ?? 0)}, linked_channels=${Number(status.linked_channels ?? 0)}`,
    };
  }

  if (command === 'kill') {
    const outcome = await control.killOrg(state.organizationId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `All agents halted.\nAudit: ${outcome.audit_code}` };
  }

  if (command === 'freeze') {
    const outcome = await control.freezeOrg(state.organizationId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `Organization frozen.\nAudit: ${outcome.audit_code}` };
  }

  if (command === 'restrict') {
    const outcome = await control.restrictOrg(state.organizationId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `Organization restricted.\nAudit: ${outcome.audit_code}` };
  }

  if (command === 'pause') {
    const agentId = args[0];
    if (!agentId) return { ok: false, text: 'ambiguous', code: 'ambiguous' };
    const outcome = await control.pauseAgent(state.organizationId, agentId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `Agent ${agentId} paused.\nAudit: ${outcome.audit_code}` };
  }

  if (command === 'resume') {
    const agentId = args[0];
    const outcome = agentId
      ? await control.resumeAgent(state.organizationId, agentId, meta)
      : await control.resumeOrg(state.organizationId, meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return {
      ok: true,
      text: agentId
        ? `Agent ${agentId} resumed.\nAudit: ${outcome.audit_code}`
        : `All agents resumed.\nAudit: ${outcome.audit_code}`,
    };
  }

  if (command === 'suspend') {
    const outcome = await control.suspendChannel(state.organizationId, 'whatsapp', meta);
    if (!outcome.ok) return { ok: false, text: outcome.error, code: outcome.code };
    return { ok: true, text: `Channel whatsapp suspended.\nAudit: ${outcome.audit_code}` };
  }

  return { ok: false, text: 'ambiguous', code: 'ambiguous' };
}

async function handleTextMessage(message: WhatsAppTextMessage, value: WhatsAppValue): Promise<void> {
  const text = typeof message.text === 'string'
    ? message.text.trim()
    : parseString(message.text?.body);
  const sender = parseString(message.from);
  if (!text || !sender) return;

  const channelUserRef = normalizePhoneRef(sender);
  const displayRef = whatsappDisplayName(value.contacts?.[0], channelUserRef);
  const linkService = await getLinkService();

  const linked = await linkService.findLinkedOperator('whatsapp', channelUserRef);
  const command = whatsappCommand(text);
  const args = whatsappArgs(text);

  if (command === 'link') {
    const code = args[0];
    if (!code) return;
    const result = await linkService.consumeLinkCode({
      code,
      channel: 'whatsapp',
      channelUserRef,
      chatRef: message.id ?? null,
      confirmedBy: displayRef,
    });
    await sendWhatsAppText(channelUserRef, result.ok
      ? 'Linked. Open Scout Settings -> Channels to manage or revoke this connection.'
      : result.code === 'expired'
        ? 'expired'
        : result.code === 'already_in_state'
          ? 'already_in_state'
          : 'not_linked');
    return;
  }

  if (!linked) {
    await sendWhatsAppText(channelUserRef, 'Not linked. Open Scout Settings -> Channels.');
    return;
  }

  if (command === 'status') {
    const outcome = await runControlAction({
      organizationId: linked.organization_id,
      dashboardUserId: linked.dashboard_user_id,
      channelUserRef,
      displayRef,
      command,
      args,
      reason: text,
      chatRef: message.id ?? null,
    }, 'status', args);
    await sendWhatsAppText(channelUserRef, outcome.text);
    return;
  }

  if (text.toUpperCase() === 'CONFIRM') {
    const pending = await getPendingConfirmation(channelUserRef);
    if (!pending) {
      await sendWhatsAppText(channelUserRef, 'expired');
      return;
    }
    await clearPendingConfirmation(channelUserRef);
    const outcome = await runControlAction(pending, pending.command, pending.args);
    await sendWhatsAppText(channelUserRef, outcome.ok ? outcome.text : outcome.text);
    return;
  }

  if (command === 'kill' || command === 'freeze' || command === 'restrict' || command === 'pause' || command === 'resume' || command === 'suspend') {
    if (command === 'kill' || command === 'freeze' || command === 'restrict') {
      const nonce = crypto.randomBytes(12).toString('hex');
      await setPendingConfirmation({
        organizationId: linked.organization_id,
        command,
        args,
        channelUserRef,
        displayRef,
        dashboardUserId: linked.dashboard_user_id,
        reason: text.slice(text.indexOf(command) + command.length).trim() || command,
        chatRef: message.id ?? null,
      });
      await sendWhatsAppText(channelUserRef, `${command} requires confirmation. Reply CONFIRM within 30 seconds.`);
      return;
    }

    const outcome = await runControlAction({
      organizationId: linked.organization_id,
      dashboardUserId: linked.dashboard_user_id,
      channelUserRef,
      displayRef,
      command,
      args,
      reason: text.slice(text.indexOf(command) + command.length).trim() || command,
      chatRef: message.id ?? null,
    }, command, args);
    await sendWhatsAppText(channelUserRef, outcome.ok ? outcome.text : outcome.text);
    return;
  }

  await sendWhatsAppText(channelUserRef, 'help');
}

function extractMessages(update: WhatsAppWebhook): Array<{ message: WhatsAppTextMessage; value: WhatsAppValue }> {
  const out: Array<{ message: WhatsAppTextMessage; value: WhatsAppValue }> = [];
  for (const entry of update.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue;
      for (const message of value.messages) {
        out.push({ message, value });
      }
    }
  }
  return out;
}

export async function handleWhatsAppWebhookBody(body: WhatsAppWebhook): Promise<void> {
  if (!featureEnabled()) return;
  for (const item of extractMessages(body)) {
    await handleTextMessage(item.message, item.value);
  }
}

export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get('/', (req: Request, res: Response): void => {
  if (!featureEnabled()) {
    res.status(404).json({ error: 'WhatsApp control is disabled' });
    return;
  }
  if (verifyTokenChallenge(req, res)) return;
});

whatsappWebhookRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  if (!featureEnabled()) {
    res.status(404).json({ error: 'WhatsApp control is disabled' });
    return;
  }
  if (!verifySecretHeader(req)) {
    res.status(401).json({ error: 'Invalid WhatsApp signature' });
    return;
  }

  try {
    await handleWhatsAppWebhookBody((req.body ?? {}) as WhatsAppWebhook);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-engine:whatsapp] webhook error:', msg);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
});

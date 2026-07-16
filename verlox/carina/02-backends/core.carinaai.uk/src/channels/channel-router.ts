import express, { type Express, type Request, type Response, type Router as ExpressRouter, Router } from 'express';
import { whatsappAdapter, extractWhatsAppPhoneNumberId, listWhatsAppInboundMessages, extractWhatsAppStatuses } from './adapters/whatsapp-adapter.js';
import { emailAdapter, extractEmailRecipient } from './adapters/email-adapter.js';
import { slackAdapter, extractSlackTeamId } from './adapters/slack-adapter.js';
import { telegramAdapter } from './adapters/telegram-adapter.js';
import { smsAdapter, extractSmsToNumber } from './adapters/sms-adapter.js';
import { teamsAdapter } from './adapters/teams-adapter.js';
import { handleParsedInbound } from './message-router.js';
import { lookupWorker, getRegistryCredentials, type RegistryEntry } from './worker-registry.js';
import { getWorker } from '../workers/worker-store.js';
import { logChannelScoutSignal } from './channel-scout-signals.js';
import { interceptSlashCommand } from './slash-commands/interceptor.js';
import { getAdapter } from './adapter-registry.js';
import './slash-commands/index.js';

export const channelWebhookRouter: ExpressRouter = Router();

function headerMap(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function processWhatsAppDeliveryStatuses(
  payload: unknown,
  entry: RegistryEntry | undefined,
): void {
  for (const status of extractWhatsAppStatuses(payload)) {
    if (status.status !== 'failed') continue;
    console.warn(`[whatsapp] delivery failed for ${status.recipientId ?? 'unknown'} (${status.id})`);
    if (!entry) continue;
    logChannelScoutSignal({
      workerId: entry.workerId,
      eventType: 'channel_delivery_failed',
      severity: 'warning',
      description: `WhatsApp delivery failed (${status.id})`,
      metadata: {
        channel: 'whatsapp',
        messageId: status.id,
        recipientId: status.recipientId,
        errors: status.errors,
      },
    });
  }
}

channelWebhookRouter.get('/webhook/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(String(challenge ?? ''));
    return;
  }
  res.sendStatus(403);
});

channelWebhookRouter.post('/webhook/whatsapp', express.raw({ type: '*/*' }), async (req, res) => {
  res.sendStatus(200);
  const rawBody = req.body as Buffer;
  if (!whatsappAdapter.verify(headerMap(req), rawBody)) {
    console.warn('[whatsapp] invalid signature');
    return;
  }

  try {
    const payload = JSON.parse(rawBody.toString()) as unknown;
    const phoneNumberId = extractWhatsAppPhoneNumberId(payload);
    if (!phoneNumberId) return;

    const entry = lookupWorker('whatsapp', phoneNumberId);

    const value = (payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: unknown[] } }> }> })
      .entry?.[0]?.changes?.[0]?.value;
    const messages = value?.messages ?? [];

    processWhatsAppDeliveryStatuses(payload, entry ?? undefined);

    if (messages.length === 0) return;

    if (!entry) return;

    const inboundMessages = listWhatsAppInboundMessages(payload, entry.workerId, entry.workspaceId);
    for (const inbound of inboundMessages) {
      await handleParsedInbound(inbound, phoneNumberId);
    }
  } catch (err) {
    console.error('[whatsapp] webhook error:', err);
    try {
      const payload = JSON.parse(rawBody.toString()) as unknown;
      const phoneNumberId = extractWhatsAppPhoneNumberId(payload);
      const entry = phoneNumberId ? lookupWorker('whatsapp', phoneNumberId) : undefined;
      if (entry) {
        logChannelScoutSignal({
          workerId: entry.workerId,
          eventType: 'channel_webhook_failed',
          severity: 'warning',
          description: err instanceof Error ? err.message : String(err),
          metadata: { channel: 'whatsapp' },
        });
      }
    } catch {
      // ignore secondary parse errors
    }
  }
});

channelWebhookRouter.post('/webhook/email', express.json({ limit: '2mb' }), async (req, res) => {
  res.sendStatus(200);
  if (!emailAdapter.verify(headerMap(req), Buffer.alloc(0))) {
    console.warn('[email] invalid webhook token');
    return;
  }

  try {
    const recipient = extractEmailRecipient(req.body);
    if (!recipient) return;
    const entry = lookupWorker('email', recipient);
    if (!entry) return;
    const inbound = emailAdapter.parse(req.body, entry.workerId, entry.workspaceId);
    if (inbound) await handleParsedInbound(inbound, recipient);
  } catch (err) {
    console.error('[email] webhook error:', err);
  }
});

channelWebhookRouter.post('/webhook/slack', express.raw({ type: '*/*' }), async (req, res) => {
  const rawBody = req.body as Buffer;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString()) as Record<string, unknown>;
  } catch {
    res.sendStatus(400);
    return;
  }

  if (body.type === 'url_verification') {
    res.json({ challenge: body.challenge });
    return;
  }

  res.sendStatus(200);

  if (!slackAdapter.verify(headerMap(req), rawBody)) {
    console.warn('[slack] invalid signature');
    return;
  }

  try {
    const teamId = extractSlackTeamId(body);
    if (!teamId) return;
    const entry = lookupWorker('slack', teamId);
    if (!entry) return;
    const inbound = slackAdapter.parse(body, entry.workerId, entry.workspaceId);
    if (inbound) await handleParsedInbound(inbound, teamId);
  } catch (err) {
    console.error('[slack] webhook error:', err);
  }
});

channelWebhookRouter.post('/webhook/telegram/:workerId', express.json({ limit: '1mb' }), async (req, res) => {
  res.sendStatus(200);
  if (!telegramAdapter.verify(headerMap(req), Buffer.alloc(0))) {
    console.warn('[telegram] invalid secret token');
    return;
  }

  try {
    const workerId = String(req.params.workerId);
    const worker = await getWorkerByIdOnly(workerId);
    if (!worker) return;
    const inbound = telegramAdapter.parse(req.body, worker.id, worker.workspaceId);
    if (!inbound) return;

    // Slash command interceptor; handle locally, skip agent
    const slashResult = await interceptSlashCommand(inbound, workerId);
    if (slashResult.handled && slashResult.response) {
      const adapter = getAdapter('telegram');
      const entry = lookupWorker('telegram', workerId);
      if (adapter && entry) {
        const credentials = getRegistryCredentials(entry);
        await adapter.send(
          { channel: 'telegram', contactId: inbound.contactId, content: slashResult.response, replyToThreadId: inbound.threadId },
          credentials,
        );
      }
      return;
    }

    const entry = lookupWorker('telegram', workerId);
    const identifier = entry ? workerId : workerId;
    await handleParsedInbound(inbound, identifier);
  } catch (err) {
    console.error('[telegram] webhook error:', err);
  }
});

channelWebhookRouter.post('/webhook/sms', express.raw({ type: '*/*' }), async (req, res) => {
  const rawBody = req.body as Buffer;
  let payload: unknown;
  try {
    payload = Object.fromEntries(new URLSearchParams(rawBody.toString()));
  } catch {
    res.sendStatus(400);
    return;
  }

  const toNumber = extractSmsToNumber(payload);
  if (!toNumber) {
    res.type('text/xml').send('<Response></Response>');
    return;
  }

  const entry = lookupWorker('sms', toNumber);
  if (!entry) {
    res.type('text/xml').send('<Response></Response>');
    return;
  }

  const credentials = getRegistryCredentials(entry);
  const webhookUrl = `${corePublicUrl()}/api/channels/webhook/sms`;
  if (!smsAdapter.verify(headerMap(req), rawBody, { ...credentials, webhook_url: webhookUrl })) {
    console.warn('[sms] invalid Twilio signature');
    res.sendStatus(403);
    return;
  }

  res.type('text/xml').send('<Response></Response>');

  try {
    const inbound = smsAdapter.parse(payload, entry.workerId, entry.workspaceId);
    if (inbound) await handleParsedInbound(inbound, toNumber);
  } catch (err) {
    console.error('[sms] webhook error:', err);
  }
});

channelWebhookRouter.post('/webhook/teams/:appId', express.json({ limit: '2mb' }), async (req, res) => {
  const appId = String(req.params.appId ?? '').trim();
  const entry = lookupWorker('teams', appId);
  if (!entry) {
    res.sendStatus(404);
    return;
  }

  const credentials = getRegistryCredentials(entry);
  if (!teamsAdapter.verify(headerMap(req), Buffer.alloc(0), credentials)) {
    console.warn('[teams] invalid bearer token');
    res.sendStatus(401);
    return;
  }

  res.status(200).send();

  try {
    const inbound = teamsAdapter.parse(req.body, entry.workerId, entry.workspaceId);
    if (inbound) await handleParsedInbound(inbound, appId);
  } catch (err) {
    console.error('[teams] webhook error:', err);
  }
});

function corePublicUrl(): string {
  return (process.env.CORE_URL ?? process.env.CARINA_CORE_URL ?? 'https://core.carinaai.uk').replace(/\/$/, '');
}

async function getWorkerByIdOnly(workerId: string) {
  const { getWorkerById } = await import('../workers/worker-store.js');
  return getWorkerById(workerId);
}

export function mountChannelWebhooks(app: Express): void {
  app.use('/api/channels', channelWebhookRouter);
}

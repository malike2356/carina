import { Router } from 'express';
import type { Request, Response, Router as ExpressRouter } from 'express';
import express from 'express';
import twilio from 'twilio';
import { lookupWorker, getRegistryCredentials } from './worker-registry.js';
import { normalizeSmsNumber } from './adapters/sms-adapter.js';
import { processAivaMessage } from '../workers/aiva-process-message.js';
import { getWorkerById, logActivity } from '../workers/worker-store.js';
import { listWorkerChannelDetails } from './channel-store.js';
import { unpackCredentials } from './credential-store.js';

export const voiceWebhookRouter: ExpressRouter = Router();

const VOICE_WEBHOOK_PATH = '/api/channels/webhook/voice';
const VOICE_GATHER_PATH = '/api/channels/webhook/voice/gather';
const VOICE_CLICK_TO_CALL_PATH = '/api/channels/webhook/voice/click-to-call';

function headerMap(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') out[key.toLowerCase()] = value;
    else if (Array.isArray(value) && value[0]) out[key.toLowerCase()] = String(value[0]);
  }
  return out;
}

function corePublicUrl(): string {
  return (process.env.CORE_URL ?? process.env.CARINA_CORE_URL ?? 'https://core.carinaai.uk').replace(/\/$/, '');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twimlClickToCallBridge(
  contactNumber: string,
  callerId: string,
  contactLabel: string,
): string {
  const label = contactLabel.trim() || 'your contact';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Say voice="Polly.Amy">Connecting you to ${escapeXml(label)} now.</Say>`,
    `  <Dial callerId="${escapeXml(callerId)}" timeout="45">`,
    `    <Number>${escapeXml(contactNumber)}</Number>`,
    '  </Dial>',
    '</Response>',
  ].join('\n');
}

/** Turn-based speech: Twilio Gather (not Media Streams duplex). */
function twimlGather(prompt: string, actionPath: string): string {
  const action = `${corePublicUrl()}${actionPath}`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Gather input="speech" timeout="5" speechTimeout="auto" language="en-GB" action="${escapeXml(action)}" method="POST">`,
    `    <Say voice="Polly.Amy">${escapeXml(prompt)}</Say>`,
    '  </Gather>',
    '  <Say voice="Polly.Amy">I did not catch that. Goodbye.</Say>',
    '</Response>',
  ].join('\n');
}

function twimlSayAndGather(say: string, actionPath: string): string {
  const action = `${corePublicUrl()}${actionPath}`;
  const spoken = say.trim().slice(0, 1200) || 'Okay.';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    `  <Say voice="Polly.Amy">${escapeXml(spoken)}</Say>`,
    `  <Gather input="speech" timeout="6" speechTimeout="auto" language="en-GB" action="${escapeXml(action)}" method="POST">`,
    '    <Say voice="Polly.Amy">Anything else?</Say>',
    '  </Gather>',
    '  <Say voice="Polly.Amy">Goodbye.</Say>',
    '</Response>',
  ].join('\n');
}

function gatherActionPath(workerId: string, direction?: string): string {
  const qs = new URLSearchParams({ workerId });
  if (direction) qs.set('direction', direction);
  return `${VOICE_GATHER_PATH}?${qs.toString()}`;
}

function verifyTwilio(
  req: Request,
  rawBody: Buffer,
  credentials: Record<string, string>,
  webhookPath: string,
): boolean {
  const signature = headerMap(req)['x-twilio-signature'];
  const authToken = credentials.auth_token?.trim();
  const url = `${corePublicUrl()}${webhookPath}`;
  if (!signature || !authToken) return false;
  try {
    return twilio.validateRequest(
      authToken,
      signature,
      url,
      Object.fromEntries(new URLSearchParams(rawBody.toString())),
    );
  } catch {
    return false;
  }
}

type VoiceChannelResolved = {
  workerId: string;
  credentials: Record<string, string>;
  fromNumber: string;
};

async function resolveVoiceChannelForWorker(workerId: string): Promise<VoiceChannelResolved | null> {
  const channels = await listWorkerChannelDetails(workerId);
  const voiceRow = channels.find((c) => c.channel === 'voice' && c.enabled)
    ?? channels.find((c) => c.channel === 'sms' && c.enabled);
  if (!voiceRow) return null;
  const credentials = unpackCredentials(voiceRow.credentials);
  const fromNumber = normalizeSmsNumber(String(credentials.from_number ?? voiceRow.identifier ?? ''));
  if (!fromNumber || !credentials.account_sid || !credentials.auth_token) return null;
  return { workerId, credentials, fromNumber };
}

function lookupByPhone(number: string | null): VoiceChannelResolved | null {
  if (!number) return null;
  const entry = lookupWorker('voice', number) ?? lookupWorker('sms', number);
  if (!entry) return null;
  return {
    workerId: entry.workerId,
    credentials: getRegistryCredentials(entry),
    fromNumber: number,
  };
}

/**
 * Resolve which Aiva owns this Twilio hit.
 * - Inbound: dialed number is `To` (our Twilio number).
 * - Outbound answer: `To` is the human; pass `workerId` (+ optional direction) on the call URL,
 *   or fall back to looking up `From` (our Twilio number).
 */
async function resolveVoiceHit(input: {
  workerIdParam: string;
  toNumber: string | null;
  fromNumber: string | null;
}): Promise<VoiceChannelResolved | null> {
  if (input.workerIdParam) {
    const byWorker = await resolveVoiceChannelForWorker(input.workerIdParam);
    if (byWorker) return byWorker;
  }
  return lookupByPhone(input.toNumber) ?? lookupByPhone(input.fromNumber);
}

voiceWebhookRouter.post('/webhook/voice', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {
  const rawBody = req.body as Buffer;
  let payload: Record<string, string> = {};
  try {
    payload = Object.fromEntries(new URLSearchParams(rawBody.toString()));
  } catch {
    res.sendStatus(400);
    return;
  }

  const workerIdParam = String(req.query.workerId ?? '').trim();
  const direction = String(req.query.direction ?? '').trim().toLowerCase();
  const outbound = direction === 'outbound' || Boolean(workerIdParam);
  const toNumber = normalizeSmsNumber(String(payload.To ?? ''));
  const fromNumber = normalizeSmsNumber(String(payload.From ?? ''));

  const resolved = await resolveVoiceHit({ workerIdParam, toNumber, fromNumber });
  if (!resolved) {
    res.type('text/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not connected to an Aiva.</Say></Response>',
    );
    return;
  }

  const verifyCandidates = [
    workerIdParam
      ? `${VOICE_WEBHOOK_PATH}?workerId=${encodeURIComponent(workerIdParam)}${direction ? `&direction=${encodeURIComponent(direction)}` : ''}`
      : null,
    workerIdParam ? `${VOICE_WEBHOOK_PATH}?workerId=${encodeURIComponent(workerIdParam)}` : null,
    VOICE_WEBHOOK_PATH,
  ].filter(Boolean) as string[];

  const signatureOk = verifyCandidates.some((path) => verifyTwilio(req, rawBody, resolved.credentials, path));
  if (!signatureOk) {
    console.warn('[voice] invalid Twilio signature');
    res.sendStatus(403);
    return;
  }

  const worker = await getWorkerById(resolved.workerId);
  const name = worker?.name || 'your Aiva';
  const contactId = outbound ? (toNumber || payload.To || 'callee') : (fromNumber || payload.From || 'caller');

  void logActivity(resolved.workerId, {
    actionType: 'message_received',
    summary: outbound
      ? `Outbound PSTN answered by ${contactId}`
      : `Inbound PSTN call from ${contactId}`,
    escalated: false,
    channel: 'voice',
    contactId: String(contactId),
  }).catch(() => undefined);

  const greeting = outbound
    ? `Hello, this is ${name} calling. How can I help you today?`
    : `Hello, this is ${name}. How can I help you today?`;

  res.type('text/xml').send(
    twimlGather(greeting, gatherActionPath(resolved.workerId, outbound ? 'outbound' : 'inbound')),
  );
});

voiceWebhookRouter.post('/webhook/voice/gather', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {
  const rawBody = req.body as Buffer;
  let payload: Record<string, string> = {};
  try {
    payload = Object.fromEntries(new URLSearchParams(rawBody.toString()));
  } catch {
    res.sendStatus(400);
    return;
  }

  const workerIdParam = String(req.query.workerId ?? '').trim();
  const direction = String(req.query.direction ?? '').trim().toLowerCase();
  const outbound = direction === 'outbound';
  const toNumber = normalizeSmsNumber(String(payload.To ?? ''));
  const fromNumber = normalizeSmsNumber(String(payload.From ?? ''));

  const resolved = await resolveVoiceHit({ workerIdParam, toNumber, fromNumber });
  if (!resolved) {
    res.type('text/xml').send('<Response><Say>Goodbye.</Say></Response>');
    return;
  }

  const pathWithQuery = gatherActionPath(resolved.workerId, direction || undefined);
  const pathWorkerOnly = gatherActionPath(resolved.workerId);
  if (
    !verifyTwilio(req, rawBody, resolved.credentials, pathWithQuery)
    && !verifyTwilio(req, rawBody, resolved.credentials, pathWorkerOnly)
    && !verifyTwilio(req, rawBody, resolved.credentials, VOICE_GATHER_PATH)
  ) {
    console.warn('[voice] invalid Twilio signature on gather');
    res.sendStatus(403);
    return;
  }

  const worker = await getWorkerById(resolved.workerId);
  if (!worker) {
    res.type('text/xml').send('<Response><Say>Goodbye.</Say></Response>');
    return;
  }

  const nextGather = gatherActionPath(worker.id, outbound ? 'outbound' : 'inbound');
  const speech = String(payload.SpeechResult ?? payload.Digits ?? '').trim();
  if (!speech) {
    res
      .type('text/xml')
      .send(twimlGather('Sorry, I did not hear that. Please try again.', nextGather));
    return;
  }

  const contactId = outbound
    ? (toNumber || String(payload.To ?? 'callee'))
    : (fromNumber || String(payload.From ?? 'caller'));

  try {
    const reply = await processAivaMessage({
      workerId: worker.id,
      workspaceId: worker.workspaceId,
      channel: 'voice',
      contactId,
      userMessage: speech,
    });

    res
      .type('text/xml')
      .send(twimlSayAndGather(reply || 'Okay.', nextGather));
  } catch (err) {
    console.error('[voice] gather error:', err);
    res
      .type('text/xml')
      .send(
        twimlSayAndGather(
          'Sorry, I had trouble with that. Please try again.',
          nextGather,
        ),
      );
  }
});

/**
 * Owner answered the click-to-call leg: bridge them to the contact number.
 */
voiceWebhookRouter.post('/webhook/voice/click-to-call', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {
  const rawBody = req.body as Buffer;
  const workerIdParam = String(req.query.workerId ?? '').trim();
  const contact = normalizeSmsNumber(String(req.query.contact ?? ''));

  const resolved = workerIdParam
    ? await resolveVoiceChannelForWorker(workerIdParam)
    : null;
  if (!resolved || !contact) {
    res.type('text/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this call could not be connected.</Say></Response>',
    );
    return;
  }

  const pathWithQuery = `${VOICE_CLICK_TO_CALL_PATH}?${new URLSearchParams({
    workerId: workerIdParam,
    contact,
  }).toString()}`;
  if (
    !verifyTwilio(req, rawBody, resolved.credentials, pathWithQuery)
    && !verifyTwilio(req, rawBody, resolved.credentials, VOICE_CLICK_TO_CALL_PATH)
  ) {
    console.warn('[voice] invalid Twilio signature on click-to-call');
    res.sendStatus(403);
    return;
  }

  res.type('text/xml').send(
    twimlClickToCallBridge(contact, resolved.fromNumber, 'your contact'),
  );
});

/** Place an outbound PSTN call using the worker voice or SMS Twilio credentials. */
export async function placeOutboundVoiceCall(input: {
  workspaceId: string;
  workerId: string;
  toNumber: string;
}): Promise<{ ok: true; callSid: string } | { ok: false; error: string }> {
  const to = normalizeSmsNumber(input.toNumber);
  if (!to) return { ok: false, error: 'Valid destination phone number required' };

  const worker = await getWorkerById(input.workerId);
  if (!worker || worker.workspaceId !== input.workspaceId) {
    return { ok: false, error: 'Worker not found' };
  }

  const resolved = await resolveVoiceChannelForWorker(input.workerId);
  if (!resolved) {
    return { ok: false, error: 'Connect a Voice or SMS Twilio number on Channels first' };
  }

  const sid = resolved.credentials.account_sid?.trim();
  const token = resolved.credentials.auth_token?.trim();
  const from = resolved.fromNumber;
  if (!from || !sid || !token) {
    return { ok: false, error: 'Twilio account_sid, auth_token, and from_number are required' };
  }

  const answerUrl = `${corePublicUrl()}${VOICE_WEBHOOK_PATH}?workerId=${encodeURIComponent(input.workerId)}&direction=outbound`;

  const client = twilio(sid, token);
  const call = await client.calls.create({
    to,
    from,
    url: answerUrl,
    method: 'POST',
  });

  await logActivity(input.workerId, {
    actionType: 'message_sent',
    summary: `Outbound PSTN call to ${to}`,
    escalated: false,
    channel: 'voice',
    contactId: to,
  }).catch(() => undefined);

  return { ok: true, callSid: call.sid };
}

/**
 * Ring the owner's phone first, then bridge them to the contact (true click-to-call).
 * Requires workspace ownerPhone and a connected Voice/SMS Twilio number.
 */
export async function placeClickToCall(input: {
  workspaceId: string;
  workerId: string;
  ownerNumber: string;
  contactNumber: string;
  contactName?: string;
}): Promise<{ ok: true; callSid: string } | { ok: false; error: string }> {
  const owner = normalizeSmsNumber(input.ownerNumber);
  const contact = normalizeSmsNumber(input.contactNumber);
  if (!owner) return { ok: false, error: 'Your phone number is missing. Add it in Settings → profile / onboarding.' };
  if (!contact) return { ok: false, error: 'Valid contact phone number required' };
  if (owner === contact) {
    return { ok: false, error: 'Owner phone and contact phone are the same number' };
  }

  const worker = await getWorkerById(input.workerId);
  if (!worker || worker.workspaceId !== input.workspaceId) {
    return { ok: false, error: 'Worker not found' };
  }

  const resolved = await resolveVoiceChannelForWorker(input.workerId);
  if (!resolved) {
    return { ok: false, error: 'Connect a Voice or SMS Twilio number on Channels first' };
  }

  const sid = resolved.credentials.account_sid?.trim();
  const token = resolved.credentials.auth_token?.trim();
  const from = resolved.fromNumber;
  if (!from || !sid || !token) {
    return { ok: false, error: 'Twilio account_sid, auth_token, and from_number are required' };
  }

  const qs = new URLSearchParams({
    workerId: input.workerId,
    contact,
  });
  const answerUrl = `${corePublicUrl()}${VOICE_CLICK_TO_CALL_PATH}?${qs.toString()}`;

  const client = twilio(sid, token);
  const call = await client.calls.create({
    to: owner,
    from,
    url: answerUrl,
    method: 'POST',
  });

  await logActivity(input.workerId, {
    actionType: 'message_sent',
    summary: `Click-to-call: ringing owner then bridging to ${contact}`,
    escalated: false,
    channel: 'voice',
    contactId: contact,
  }).catch(() => undefined);

  return { ok: true, callSid: call.sid };
}

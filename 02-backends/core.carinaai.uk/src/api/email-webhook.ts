import { Router, type Request, type Response, type IRouter } from 'express';
import { pool } from '../memory/db.js';
import { parseSvixHeaders, verifyResendWebhook } from '../lib/resend-webhook.js';
import { resolveResendWebhookSecret } from '../email/resend-client.js';
import {
  verifyMailgunWebhookSignature,
  isMailgunSignatureRequired,
} from '../ingestion/email/mailgun-inbound.js';
import { bumpOutreachCounter } from '../outreach/observability/counters.js';

export const emailEvents = {
  listeners: [] as Array<(payload: InboundEmailPayload) => void>,
  onReceived(handler: (payload: InboundEmailPayload) => void): void {
    this.listeners.push(handler);
  },
  emit(payload: InboundEmailPayload): void {
    for (const fn of this.listeners) {
      fn(payload);
    }
  },
};

export interface InboundEmailPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  messageId: string;
}

function parsePayload(body: Record<string, unknown>): InboundEmailPayload {
  const data = (body.data ?? body) as Record<string, unknown>;
  return {
    from: String(data.from ?? body.from ?? ''),
    to: String(data.to ?? body.to ?? ''),
    subject: String(data.subject ?? body.subject ?? ''),
    text: String(data.text ?? body.text ?? ''),
    html: String(data.html ?? body.html ?? ''),
    messageId: String(data.message_id ?? data.messageId ?? body.message_id ?? ''),
  };
}

function verifyResendSignedRequest(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = resolveResendWebhookSecret();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, status: 503, error: 'RESEND_WEBHOOK_SECRET not configured' };
    }
    return { ok: true };
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf-8')
    ?? JSON.stringify(req.body ?? {});
  const svix = parseSvixHeaders(req.headers as Record<string, string | string[] | undefined>);
  if (!svix || !verifyResendWebhook(rawBody, svix, secret)) {
    bumpOutreachCounter('webhookSignatureFailures');
    return { ok: false, status: 401, error: 'Invalid webhook signature' };
  }
  return { ok: true };
}

function verifyMailgunSignedRequest(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  if (!isMailgunSignatureRequired()) return { ok: true };
  const body = (req.body ?? {}) as Record<string, unknown>;
  const signature = (body.signature && typeof body.signature === 'object')
    ? body.signature as Record<string, unknown>
    : body;
  const ok = verifyMailgunWebhookSignature({
    timestamp: String(signature.timestamp ?? body.timestamp ?? ''),
    token: String(signature.token ?? body.token ?? ''),
    signature: String(signature.signature ?? body.signature ?? ''),
  });
  if (!ok) {
    bumpOutreachCounter('webhookSignatureFailures');
    return { ok: false, status: 401, error: 'Invalid Mailgun webhook signature' };
  }
  return { ok: true };
}

export const emailWebhookRouter: IRouter = Router();

emailWebhookRouter.post('/inbound', async (req: Request, res: Response) => {
  try {
    const auth = verifyResendSignedRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    const payload = parsePayload(req.body as Record<string, unknown>);

    await pool.query(
      `INSERT INTO inbound_emails (from_address, to_address, subject, body_text, body_html, message_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (message_id) DO NOTHING`,
      [
        payload.from,
        payload.to,
        payload.subject,
        payload.text,
        payload.html,
        payload.messageId || null,
      ],
    );

    emailEvents.emit(payload);
    res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/** Resend delivery / engagement events (signed). */
emailWebhookRouter.post('/events', async (req: Request, res: Response) => {
  try {
    const auth = verifyResendSignedRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const svix = parseSvixHeaders(req.headers as Record<string, string | string[] | undefined>);
    const { normalizeResendDeliveryEvent } = await import('../outreach/provider-events/normalize.js');
    const { applyProviderEvent } = await import('../outreach/provider-events/apply.js');
    const normalized = normalizeResendDeliveryEvent({
      body: (req.body ?? {}) as Record<string, unknown>,
      svixId: svix?.id,
    });
    if (!normalized) {
      res.status(200).json({ ok: true, ignored: true, reason: 'unmapped_event' });
      return;
    }
    const result = await applyProviderEvent(normalized);
    res.status(200).json({ ok: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/** Mailgun delivery / engagement events (HMAC). */
emailWebhookRouter.post('/mailgun/events', async (req: Request, res: Response) => {
  try {
    const auth = verifyMailgunSignedRequest(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    const { normalizeMailgunDeliveryEvent } = await import('../outreach/provider-events/normalize.js');
    const { applyProviderEvent } = await import('../outreach/provider-events/apply.js');
    const normalized = normalizeMailgunDeliveryEvent({
      body: (req.body ?? {}) as Record<string, unknown>,
    });
    if (!normalized) {
      res.status(200).json({ ok: true, ignored: true, reason: 'unmapped_event' });
      return;
    }
    const result = await applyProviderEvent(normalized);
    res.status(200).json({ ok: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

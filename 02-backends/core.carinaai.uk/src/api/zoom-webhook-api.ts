/**
 * Public Zoom webhook ingress (Prompt 703).
 * No cloud-proxy auth; signature validation is the trust boundary.
 */

import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  buildZoomUrlValidationResponse,
  handleZoomWebhookEvent,
  verifyZoomWebhookSignature,
} from '../vical/index.js';
import { zoomWebhookSecret } from '../workers/product-tools/zoom-oauth.js';

export const zoomWebhookRouter: ExpressRouter = Router();

zoomWebhookRouter.post('/zoom', (req: Request, res: Response) => {
  const secret = zoomWebhookSecret();
  const body = req.body ?? {};

  if (body.event === 'endpoint.url_validation') {
    const plainToken = String(body.payload?.plainToken ?? '');
    if (!plainToken || !secret) {
      res.status(400).json({ error: 'validation_failed' });
      return;
    }
    res.json(buildZoomUrlValidationResponse(plainToken, secret));
    return;
  }

  const rawBody =
    typeof (req as Request & { rawBody?: string }).rawBody === 'string'
      ? (req as Request & { rawBody?: string }).rawBody!
      : JSON.stringify(body);
  const timestamp = String(req.headers['x-zm-request-timestamp'] ?? '');
  const signature = String(req.headers['x-zm-signature'] ?? '');

  if (!secret || !verifyZoomWebhookSignature({ rawBody, timestamp, signature, secret })) {
    res.status(401).json({ error: 'invalid_signature' });
    return;
  }

  const result = handleZoomWebhookEvent({
    event: String(body.event ?? ''),
    eventTs: body.event_ts,
    payload: (body.payload ?? {}) as Record<string, unknown>,
  });
  res.status(200).json({ ok: result.ok, duplicate: result.duplicate ?? false });
});

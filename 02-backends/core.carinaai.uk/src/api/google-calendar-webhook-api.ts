/**
 * Public Google Calendar webhook ingress (Prompt 704).
 */

import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { handleGoogleCalendarWebhook } from '../vical/saga/webhook-google.js';

export const googleCalendarWebhookRouter: ExpressRouter = Router();

googleCalendarWebhookRouter.post('/google-calendar', async (req: Request, res: Response) => {
  const channelId = String(req.headers['x-goog-channel-id'] ?? '');
  const resourceId = String(req.headers['x-goog-resource-id'] ?? '');
  const resourceState = String(req.headers['x-goog-resource-state'] ?? '');
  const messageNumber = String(req.headers['x-goog-message-number'] ?? '');
  const channelToken = String(req.headers['x-goog-channel-token'] ?? '');
  const resourceUri = String(req.headers['x-goog-resource-uri'] ?? '');

  const result = await handleGoogleCalendarWebhook({
    channelId,
    resourceId,
    resourceState,
    messageNumber: messageNumber || undefined,
    channelToken,
    resourceUri: resourceUri || undefined,
  });

  if (result.rejected) {
    res.status(401).json({ error: result.reason ?? 'unauthorized' });
    return;
  }
  res.status(200).json({
    ok: result.ok,
    duplicate: result.duplicate ?? false,
    bookingId: result.bookingId,
    deliveryState: result.deliveryState,
  });
});

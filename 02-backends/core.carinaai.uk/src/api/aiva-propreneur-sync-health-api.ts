import express, { type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  enqueueMissingEventReplay,
  getPropreneurSyncHealth,
} from '../sync/propreneur-event-inbox.js';

export const aivaPropreneurSyncHealthRouter: ExpressRouter = express.Router();

aivaPropreneurSyncHealthRouter.get('/propreneur/sync-health', (_req: Request, res: Response) => {
  const health = getPropreneurSyncHealth();
  res.json({
    ok: true,
    last_event: health.lastEventId,
    last_received_at: health.lastReceivedAt,
    lag_seconds: health.lagSeconds,
    retries: health.retryCount,
    pending: health.pendingCount,
    dead_letter_count: health.deadLetterCount,
    schema_version: health.schemaVersion,
  });
});

aivaPropreneurSyncHealthRouter.post(
  '/propreneur/replay/:eventId',
  (req: Request, res: Response) => {
    const eventId = String(req.params.eventId ?? '').trim();
    if (!eventId) {
      res.status(400).json({ error: 'eventId required' });
      return;
    }
    res.json(enqueueMissingEventReplay(eventId));
  },
);

import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { fetchCalDavEventsInRangeWithCredentials } from '../integrations/caldav-client.js';

export const internalCalendarApiRouter: ExpressRouter = Router();

function resolveExpectedInternalKey(): string {
  return (
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    process.env.CARINA_CLOUD_INTERNAL_KEY?.trim() ||
    ''
  );
}

function isInternalCalendarAuthorized(req: Request): boolean {
  if (isControlAuthorized(req)) return true;
  const expected = resolveExpectedInternalKey();
  if (!expected) return false;
  const headerKey = String(req.headers['x-internal-key'] ?? '').trim();
  return headerKey === expected;
}

internalCalendarApiRouter.use((req: Request, res: Response, next) => {
  if (!isInternalCalendarAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

internalCalendarApiRouter.post('/sync', async (req: Request, res: Response) => {
  const url = String(req.body?.url ?? '').trim();
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const startRaw = String(req.body?.start ?? '');
  const endRaw = String(req.body?.end ?? '');

  if (!url || !username || !password) {
    res.status(400).json({ error: 'url, username, and password are required' });
    return;
  }

  const now = new Date();
  const start = startRaw ? new Date(startRaw) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = endRaw
    ? new Date(endRaw)
    : new Date(now.getFullYear(), now.getMonth() + 4, 0, 23, 59, 59, 999);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    res.status(400).json({ error: 'Invalid start/end range' });
    return;
  }

  try {
    const result = await fetchCalDavEventsInRangeWithCredentials(
      { url, username, password },
      start,
      end,
    );
    res.json({
      events: result.events.map((event) => ({
        uid: event.uid,
        summary: event.summary,
        dtStart: event.dtStart.toISOString(),
        dtEnd: event.dtEnd?.toISOString(),
        allDay: event.allDay,
      })),
      calendarUrl: result.calendarUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
});

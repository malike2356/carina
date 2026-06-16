import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { listNotes } from '../gateway/notes-store.js';
import {
  fetchCalDavEventsInRange,
  getCalDavSyncDiagnostics,
  isCalDavConfigured,
} from '../integrations/caldav-client.js';
import { internalCalendarApiRouter } from './internal-calendar-api.js';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  source: 'notes' | 'caldav';
  href?: string;
  overdue?: boolean;
}

const OPERATOR_TENANT = '__operator__';

export function getCalDavSyncStatus() {
  return getCalDavSyncDiagnostics();
}

export { isCalDavConfigured };

function parseIsoDate(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function notesReminderEvents(start: Date, end: Date): CalendarEvent[] {
  const notes = listNotes(OPERATOR_TENANT, 'reminder');
  const events: CalendarEvent[] = [];

  for (const note of notes) {
    if (!note.remindAt || note.done) continue;
    const when = new Date(note.remindAt);
    if (Number.isNaN(when.getTime())) continue;
    if (when < start || when > end) continue;
    events.push({
      id: `note-${note.id}`,
      title: note.title || 'Reminder',
      start: when.toISOString(),
      source: 'notes',
      href: '/notes',
      overdue: when < new Date(),
    });
  }

  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export async function fetchCalDavEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
  if (!isCalDavConfigured()) return [];

  try {
    const result = await fetchCalDavEventsInRange(start, end);
    return result.events.map((event) => ({
      id: `caldav-${event.uid}`,
      title: event.summary,
      start: event.dtStart.toISOString(),
      end: event.dtEnd?.toISOString(),
      allDay: event.allDay,
      source: 'caldav' as const,
      href: event.href,
    }));
  } catch {
    return [];
  }
}

export async function listCalendarEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
  const noteEvents = notesReminderEvents(start, end);
  const external = await fetchCalDavEvents(start, end);
  return [...noteEvents, ...external].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

export const calendarApiRouter: ExpressRouter = Router();

calendarApiRouter.use('/cloud', internalCalendarApiRouter);

calendarApiRouter.get('/events', async (req: Request, res: Response) => {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
  const start = parseIsoDate(String(req.query.start ?? ''), defaultStart);
  const end = parseIsoDate(String(req.query.end ?? ''), defaultEnd);

  if (end < start) {
    res.status(400).json({ error: 'end must be after start' });
    return;
  }

  const events = await listCalendarEvents(start, end);
  res.json({
    events,
    range: { start: start.toISOString(), end: end.toISOString() },
    sources: {
      notes: events.filter((e) => e.source === 'notes').length,
      caldav: events.filter((e) => e.source === 'caldav').length,
    },
    sync: getCalDavSyncStatus(),
  });
});

calendarApiRouter.get('/sync/status', (_req: Request, res: Response) => {
  res.json(getCalDavSyncStatus());
});

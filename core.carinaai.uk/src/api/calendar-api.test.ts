import express from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('calendar-api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns sync status when CalDAV is not configured', async () => {
    vi.doMock('../config/index.js', () => ({
      config: {
        caldav: { url: '', username: '', password: '', principalUrl: '' },
      },
    }));
    vi.doMock('../gateway/notes-store.js', () => ({
      listNotes: vi.fn().mockReturnValue([]),
    }));
    vi.doMock('../integrations/caldav-client.js', () => ({
      isCalDavConfigured: () => false,
      getCalDavSyncDiagnostics: () => ({
        configured: false,
        syncReady: false,
        implementation: 'none',
        url: null,
        calendarUrl: null,
        message: 'Set CALDAV_URL, CALDAV_USERNAME, and CALDAV_PASSWORD to enable calendar sync.',
        lastSyncAt: null,
        lastSyncError: null,
        eventCount: 0,
      }),
      fetchCalDavEventsInRange: vi.fn(),
    }));

    const { calendarApiRouter, getCalDavSyncStatus } = await import('./calendar-api.js');
    expect(getCalDavSyncStatus().configured).toBe(false);
    expect(getCalDavSyncStatus().implementation).toBe('none');
    expect(getCalDavSyncStatus().message).toContain('CALDAV_URL');

    const app = express();
    app.use('/api/calendar', calendarApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/calendar/sync/status`);
        const data = await res.json() as { configured: boolean; message: string };
        expect(res.status).toBe(200);
        expect(data.configured).toBe(false);
        server.close(() => resolve());
      });
    });
  });

  it('returns calendar events with notes reminders', async () => {
    vi.doMock('../config/index.js', () => ({
      config: {
        caldav: { url: '', username: '', password: '', principalUrl: '' },
      },
    }));
    vi.doMock('../gateway/notes-store.js', () => ({
      listNotes: vi.fn().mockReturnValue([
        {
          id: 'n1',
          title: 'Call supplier',
          remindAt: '2026-06-20T10:00:00.000Z',
          done: false,
          format: 'reminder',
        },
      ]),
    }));
    vi.doMock('../integrations/caldav-client.js', () => ({
      isCalDavConfigured: () => false,
      getCalDavSyncDiagnostics: () => ({
        configured: false,
        syncReady: false,
        implementation: 'none',
        url: null,
        calendarUrl: null,
        message: 'Set CALDAV_URL, CALDAV_USERNAME, and CALDAV_PASSWORD to enable calendar sync.',
        lastSyncAt: null,
        lastSyncError: null,
        eventCount: 0,
      }),
      fetchCalDavEventsInRange: vi.fn(),
    }));

    const { calendarApiRouter } = await import('./calendar-api.js');
    const app = express();
    app.use('/api/calendar', calendarApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const url = `http://127.0.0.1:${port}/api/calendar/events?start=2026-06-01T00:00:00.000Z&end=2026-06-30T23:59:59.999Z`;
        const res = await fetch(url);
        const data = await res.json() as { events: Array<{ id: string; source: string; title: string }> };
        expect(res.status).toBe(200);
        expect(data.events).toHaveLength(1);
        expect(data.events[0]?.source).toBe('notes');
        expect(data.events[0]?.title).toBe('Call supplier');
        server.close(() => resolve());
      });
    });
  });

  it('merges CalDAV events when sync is configured', async () => {
    vi.doMock('../config/index.js', () => ({
      config: {
        caldav: {
          url: 'https://caldav.example.com/personal/',
          username: 'user',
          password: 'pass',
          principalUrl: '',
        },
      },
    }));
    vi.doMock('../gateway/notes-store.js', () => ({
      listNotes: vi.fn().mockReturnValue([]),
    }));
    vi.doMock('../integrations/caldav-client.js', () => ({
      isCalDavConfigured: () => true,
      getCalDavSyncDiagnostics: () => ({
        configured: true,
        syncReady: true,
        implementation: 'live',
        url: 'https://caldav.example.com/personal/',
        calendarUrl: 'https://caldav.example.com/personal/',
        message: 'CalDAV sync active.',
        lastSyncAt: '2026-06-15T12:00:00.000Z',
        lastSyncError: null,
        eventCount: 1,
      }),
      fetchCalDavEventsInRange: vi.fn().mockResolvedValue({
        events: [{
          uid: 'evt-1',
          summary: 'Team standup',
          dtStart: new Date('2026-06-18T09:00:00.000Z'),
          allDay: false,
        }],
        calendarUrl: 'https://caldav.example.com/personal/',
        fetchedAt: '2026-06-15T12:00:00.000Z',
      }),
    }));

    const { calendarApiRouter } = await import('./calendar-api.js');
    const app = express();
    app.use('/api/calendar', calendarApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const url = `http://127.0.0.1:${port}/api/calendar/events?start=2026-06-01T00:00:00.000Z&end=2026-06-30T23:59:59.999Z`;
        const res = await fetch(url);
        const data = await res.json() as {
          events: Array<{ source: string; title: string }>;
          sync: { implementation: string };
        };
        expect(res.status).toBe(200);
        expect(data.events).toHaveLength(1);
        expect(data.events[0]?.source).toBe('caldav');
        expect(data.events[0]?.title).toBe('Team standup');
        expect(data.sync.implementation).toBe('live');
        server.close(() => resolve());
      });
    });
  });
});

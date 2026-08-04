import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchGoogleCalendarEventsInRange,
  refreshGoogleAccessToken,
} from './google-calendar-client';

describe('google-calendar-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes an access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'ya29.test', expires_in: 3600 }),
      }),
    );

    const token = await refreshGoogleAccessToken({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
    });
    expect(token).toBe('ya29.test');
  });

  it('maps Google Calendar events into sync shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'ya29.test' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'evt-1',
                summary: 'Team standup',
                start: { dateTime: '2026-06-25T09:00:00Z' },
                end: { dateTime: '2026-06-25T09:30:00Z' },
              },
            ],
          }),
        }),
    );

    const result = await fetchGoogleCalendarEventsInRange(
      {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        calendarId: 'primary',
      },
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-30T23:59:59Z'),
    );

    expect(result.calendarId).toBe('primary');
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.summary).toBe('Team standup');
    expect(result.events[0]?.uid).toBe('evt-1');
  });

  it('merges events across multiple calendars and dedupes by uid', async () => {
    const { fetchGoogleCalendarsEventsInRange } = await import('./google-calendar-client');
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'ya29.test' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'shared',
                summary: 'Shared',
                start: { date: '2026-07-28' },
                end: { date: '2026-07-29' },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'shared',
                summary: 'Shared',
                start: { date: '2026-07-28' },
                end: { date: '2026-07-29' },
              },
              {
                id: 'other',
                summary: 'Goodwood Qatar',
                start: { dateTime: '2026-08-01T09:00:00Z' },
                end: { dateTime: '2026-08-01T19:00:00Z' },
              },
            ],
          }),
        }),
    );

    const result = await fetchGoogleCalendarsEventsInRange(
      {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        refreshToken: 'refresh-token',
        calendarIds: ['primary', 'other@group.calendar.google.com'],
      },
      new Date('2026-07-01T00:00:00Z'),
      new Date('2026-08-31T23:59:59Z'),
    );

    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.uid).sort()).toEqual(['other', 'shared']);
  });
});

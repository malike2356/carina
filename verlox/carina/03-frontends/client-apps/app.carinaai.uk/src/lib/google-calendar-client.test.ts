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
});

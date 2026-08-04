export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface GoogleCalendarCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
}

export interface GoogleCalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  dtStart: Date;
  dtEnd?: Date;
  allDay: boolean;
  aivaManaged?: boolean;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleEventsResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    description?: string;
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
    extendedProperties?: { private?: Record<string, string> };
  }>;
  error?: { message?: string };
}

export async function refreshGoogleAccessToken(
  creds: Pick<GoogleCalendarCredentials, 'clientId' | 'clientSecret' | 'refreshToken'>,
): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Google token refresh failed');
  }
  return data.access_token;
}

export async function exchangeGoogleOAuthCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ refreshToken: string; accessToken: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await response.json()) as GoogleTokenResponse & { refresh_token?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Google OAuth exchange failed');
  }
  if (!data.refresh_token) {
    throw new Error('Google did not return a refresh token. Revoke prior access and reconnect with consent.');
  }
  return { refreshToken: data.refresh_token, accessToken: data.access_token };
}

export function buildGoogleCalendarOAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function parseGoogleEventDate(value?: { date?: string; dateTime?: string }): {
  date: Date;
  allDay: boolean;
} | null {
  if (!value) return null;
  if (value.date) {
    const [y, m, d] = value.date.split('-').map(Number);
    return { date: new Date(Date.UTC(y, m - 1, d)), allDay: true };
  }
  if (value.dateTime) {
    const parsed = new Date(value.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : { date: parsed, allDay: false };
  }
  return null;
}

function mapGoogleEventItems(items: GoogleEventsResponse['items']): GoogleCalendarEvent[] {
  const events: GoogleCalendarEvent[] = [];
  for (const item of items ?? []) {
    const startParsed = parseGoogleEventDate(item.start);
    if (!startParsed || !item.id) continue;
    const endParsed = parseGoogleEventDate(item.end);
    events.push({
      uid: item.id,
      summary: item.summary?.trim() || 'Event',
      description: item.description?.trim() || undefined,
      dtStart: startParsed.date,
      dtEnd: endParsed?.date,
      allDay: startParsed.allDay,
      aivaManaged: item.extendedProperties?.private?.aivaManaged === 'true',
    });
  }
  return events;
}

export async function listSelectedGoogleCalendarIds(
  creds: Pick<GoogleCalendarCredentials, 'clientId' | 'clientSecret' | 'refreshToken'>,
): Promise<string[]> {
  const accessToken = await refreshGoogleAccessToken(creds);
  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList?minAccessRole=reader`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json()) as {
    items?: Array<{ id?: string; selected?: boolean; primary?: boolean }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Google Calendar list error ${response.status}`);
  }

  const ids = new Set<string>();
  for (const item of data.items ?? []) {
    if (!item.id) continue;
    if (item.primary || item.selected || item.id === 'primary') {
      ids.add(item.id);
    }
  }
  if (ids.size === 0) ids.add('primary');
  return [...ids];
}

export async function fetchGoogleCalendarEventsInRange(
  creds: GoogleCalendarCredentials,
  start: Date,
  end: Date,
  accessToken?: string,
): Promise<{ events: GoogleCalendarEvent[]; calendarId: string }> {
  const token = accessToken ?? (await refreshGoogleAccessToken(creds));
  const calendarId = creds.calendarId.trim() || 'primary';
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    fields:
      'items(id,summary,description,start,end,extendedProperties/private)',
  });

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    },
  );

  const data = (await response.json()) as GoogleEventsResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Google Calendar API error ${response.status}`);
  }

  return { events: mapGoogleEventItems(data.items), calendarId };
}

export async function fetchGoogleCalendarsEventsInRange(
  creds: Omit<GoogleCalendarCredentials, 'calendarId'> & { calendarIds: string[] },
  start: Date,
  end: Date,
): Promise<{ events: GoogleCalendarEvent[]; calendarIds: string[] }> {
  const accessToken = await refreshGoogleAccessToken(creds);
  const calendarIds = [...new Set(creds.calendarIds.map((id) => id.trim()).filter(Boolean))];
  if (calendarIds.length === 0) calendarIds.push('primary');

  const byUid = new Map<string, GoogleCalendarEvent>();
  const errors: string[] = [];

  for (const calendarId of calendarIds) {
    try {
      const result = await fetchGoogleCalendarEventsInRange(
        { ...creds, calendarId },
        start,
        end,
        accessToken,
      );
      for (const event of result.events) {
        byUid.set(event.uid, event);
      }
    } catch (err) {
      errors.push(`${calendarId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (byUid.size === 0 && errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  return { events: [...byUid.values()], calendarIds };
}

export async function testGoogleCalendarConnection(
  creds: GoogleCalendarCredentials,
): Promise<{ ok: true; calendarId: string; eventCount: number } | { ok: false; error: string }> {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const result = await fetchGoogleCalendarEventsInRange(creds, start, end);
    return { ok: true, calendarId: result.calendarId, eventCount: result.events.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

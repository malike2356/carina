import { config } from '../config/index.js';

export interface CalDavEvent {
  uid: string;
  summary: string;
  dtStart: Date;
  dtEnd?: Date;
  allDay: boolean;
  href?: string;
}

export interface CalDavFetchResult {
  events: CalDavEvent[];
  calendarUrl: string;
  fetchedAt: string;
}

export interface CalDavSyncDiagnostics {
  configured: boolean;
  syncReady: boolean;
  implementation: 'none' | 'live' | 'error';
  url: string | null;
  calendarUrl: string | null;
  message: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  eventCount: number;
}

const CACHE_TTL_MS = 60_000;

let resolvedCalendarUrl: string | null = null;
let lastSyncAt: Date | null = null;
let lastSyncError: string | null = null;
let lastEventCount = 0;
let cacheKey = '';
let cacheExpiresAt = 0;
let cacheEvents: CalDavEvent[] = [];

function calDavConfig() {
  return {
    url: config.caldav.url.trim(),
    username: config.caldav.username.trim(),
    password: config.caldav.password.trim(),
    principalUrl: config.caldav.principalUrl.trim(),
  };
}

export function isCalDavConfigured(): boolean {
  const c = calDavConfig();
  return Boolean(c.url && c.username && c.password);
}

export function buildBasicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

export function formatCalDavUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function unfoldIcsLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of raw) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (lines.length) lines[lines.length - 1] += line.slice(1);
      continue;
    }
    lines.push(line);
  }
  return lines;
}

export function parseIcsDateValue(value: string, params: string): { date: Date; allDay: boolean } {
  const allDay = /VALUE=DATE/i.test(params) || (/^\d{8}$/.test(value) && !value.includes('T'));
  if (allDay) {
    const compact = value.replace(/\D/g, '').slice(0, 8);
    const y = Number(compact.slice(0, 4));
    const m = Number(compact.slice(4, 6)) - 1;
    const d = Number(compact.slice(6, 8));
    return { date: new Date(Date.UTC(y, m, d)), allDay: true };
  }

  const normalized = value.includes('T') ? value : `${value.slice(0, 8)}T${value.slice(8)}`;
  const utc = normalized.endsWith('Z');
  const match = normalized.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!match) {
    const parsed = new Date(value);
    return { date: Number.isNaN(parsed.getTime()) ? new Date(0) : parsed, allDay: false };
  }
  const [, ys, ms, ds, hs, mins, secs] = match;
  const date = utc
    ? new Date(Date.UTC(Number(ys), Number(ms) - 1, Number(ds), Number(hs), Number(mins), Number(secs)))
    : new Date(Number(ys), Number(ms) - 1, Number(ds), Number(hs), Number(mins), Number(secs));
  return { date, allDay: false };
}

export function parseVeventsFromIcs(icsText: string, href?: string): CalDavEvent[] {
  const events: CalDavEvent[] = [];
  const blocks = icsText.split(/BEGIN:VEVENT/i);
  for (const block of blocks.slice(1)) {
    const body = block.split(/END:VEVENT/i)[0] ?? '';
    const lines = unfoldIcsLines(body);
    let uid = '';
    let summary = 'Event';
    let dtStart: Date | null = null;
    let dtEnd: Date | undefined;
    let allDay = false;

    for (const line of lines) {
      const sep = line.indexOf(':');
      if (sep <= 0) continue;
      const keyPart = line.slice(0, sep);
      const value = line.slice(sep + 1).trim();
      const key = keyPart.split(';')[0]?.toUpperCase() ?? '';
      const params = keyPart.includes(';') ? keyPart : '';

      if (key === 'UID') uid = value;
      if (key === 'SUMMARY') summary = value.replace(/\\n/g, ' ').replace(/\\,/g, ',');
      if (key === 'DTSTART') {
        const parsed = parseIcsDateValue(value, params);
        dtStart = parsed.date;
        allDay = parsed.allDay;
      }
      if (key === 'DTEND') {
        const parsed = parseIcsDateValue(value, params);
        dtEnd = parsed.date;
        if (parsed.allDay) allDay = true;
      }
    }

    if (!uid || !dtStart || Number.isNaN(dtStart.getTime())) continue;
    events.push({ uid, summary, dtStart, dtEnd, allDay, href });
  }
  return events;
}

export function extractCalendarDataBlocks(xml: string): Array<{ href?: string; ics: string }> {
  const blocks: Array<{ href?: string; ics: string }> = [];
  const responseChunks = xml.split(/<(?:[a-zA-Z0-9]+:)?response\b/i);
  for (const chunk of responseChunks.slice(1)) {
    const hrefMatch = chunk.match(/<(?:[a-zA-Z0-9]+:)?href[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?href>/i);
    const href = hrefMatch?.[1]?.trim();
    const dataMatch = chunk.match(/<(?:[a-zA-Z0-9]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?calendar-data>/i);
    if (!dataMatch?.[1]) continue;
    const ics = dataMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .trim();
    if (ics.includes('BEGIN:VCALENDAR')) blocks.push({ href, ics });
  }
  return blocks;
}

export function extractHrefFromProp(xml: string, propName: string): string | null {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${propName}[^>]*>\\s*<(?:[a-zA-Z0-9]+:)?href[^>]*>([^<]+)<\\/(?:[a-zA-Z0-9]+:)?href>`, 'i');
  const match = xml.match(re);
  return match?.[1]?.trim() ?? null;
}

export function extractCalendarCollectionHrefs(xml: string): string[] {
  const hrefs: string[] = [];
  const responseChunks = xml.split(/<(?:[a-zA-Z0-9]+:)?response\b/i);
  for (const chunk of responseChunks.slice(1)) {
    if (!/<(?:[a-zA-Z0-9]+:)?calendar\b/i.test(chunk)) continue;
    const hrefMatch = chunk.match(/<(?:[a-zA-Z0-9]+:)?href[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?href>/i);
    const href = hrefMatch?.[1]?.trim();
    if (href && !href.endsWith('/')) hrefs.push(`${href}/`);
    else if (href) hrefs.push(href);
  }
  return hrefs;
}

function joinUrl(base: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  const root = new URL(base.endsWith('/') ? base : `${base}/`);
  return new URL(href.startsWith('/') ? href.slice(1) : href, root).toString();
}

async function calDavRequest(
  url: string,
  method: string,
  authHeader: string,
  body?: string,
  depth?: 0 | 1,
): Promise<{ ok: boolean; status: number; text: string }> {
  const headers: Record<string, string> = {
    Authorization: authHeader,
    Accept: '*/*',
  };
  if (body) {
    headers['Content-Type'] = 'application/xml; charset=utf-8';
  }
  if (depth !== undefined) {
    headers.Depth = String(depth);
  }

  const response = await fetch(url, { method, headers, body });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

const PROPFIND_RESOURCETYPE = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:resourcetype/>
    <D:displayname/>
  </D:prop>
</D:propfind>`;

const PROPFIND_HOME = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-home-set/>
    <D:current-user-principal/>
  </D:prop>
</D:propfind>`;

function buildCalendarQuery(start: Date, end: Date): string {
  return `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${formatCalDavUtc(start)}" end="${formatCalDavUtc(end)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;
}

async function isCalendarCollection(url: string, authHeader: string): Promise<boolean> {
  const res = await calDavRequest(url, 'PROPFIND', authHeader, PROPFIND_RESOURCETYPE, 0);
  if (!res.ok) return false;
  return /<(?:[a-zA-Z0-9]+:)?calendar\b/i.test(res.text);
}

async function discoverCalendarUrl(authHeader: string): Promise<string> {
  const c = calDavConfig();
  if (resolvedCalendarUrl) return resolvedCalendarUrl;

  const candidates: string[] = [];
  if (c.principalUrl) candidates.push(c.principalUrl);
  if (c.url) candidates.push(c.url);

  for (const candidate of candidates) {
    const base = candidate.endsWith('/') ? candidate : `${candidate}/`;
    const homeRes = await calDavRequest(base, 'PROPFIND', authHeader, PROPFIND_HOME, 0);
    if (!homeRes.ok) continue;

    const homeHref = extractHrefFromProp(homeRes.text, 'calendar-home-set')
      ?? extractHrefFromProp(homeRes.text, 'current-user-principal');
    if (!homeHref) continue;

    const homeUrl = joinUrl(base, homeHref);
    const listRes = await calDavRequest(homeUrl, 'PROPFIND', authHeader, PROPFIND_RESOURCETYPE, 1);
    if (!listRes.ok) continue;

    const collections = extractCalendarCollectionHrefs(listRes.text);
    if (collections.length) {
      const preferred = collections.find((href) => /personal|default|calendar/i.test(href)) ?? collections[0];
      resolvedCalendarUrl = preferred ?? null;
      if (resolvedCalendarUrl) return resolvedCalendarUrl;
    }
  }

  if (c.url) {
    const direct = c.url.endsWith('/') ? c.url : `${c.url}/`;
    if (await isCalendarCollection(direct, authHeader)) {
      resolvedCalendarUrl = direct;
      return direct;
    }
  }

  throw new Error('Could not resolve a CalDAV calendar collection. Set CALDAV_URL to your calendar collection URL or CALDAV_PRINCIPAL_URL for discovery.');
}

export async function resolveCalendarCollectionUrl(authHeader: string): Promise<string> {
  const c = calDavConfig();
  if (resolvedCalendarUrl) return resolvedCalendarUrl;

  if (c.url) {
    const direct = c.url.endsWith('/') ? c.url : `${c.url}/`;
    if (await isCalendarCollection(direct, authHeader)) {
      resolvedCalendarUrl = direct;
      return direct;
    }
  }

  return discoverCalendarUrl(authHeader);
}

export function eventOverlapsRange(event: CalDavEvent, start: Date, end: Date): boolean {
  const eventStart = event.dtStart;
  const eventEnd = event.dtEnd ?? event.dtStart;
  return eventStart <= end && eventEnd >= start;
}

export async function fetchCalDavEventsInRange(start: Date, end: Date): Promise<CalDavFetchResult> {
  const c = calDavConfig();
  if (!c.url || !c.username || !c.password) {
    return { events: [], calendarUrl: '', fetchedAt: new Date().toISOString() };
  }

  const key = `${start.toISOString()}|${end.toISOString()}|${c.url}|${c.username}`;
  const now = Date.now();
  if (cacheKey === key && cacheExpiresAt > now) {
    return {
      events: cacheEvents,
      calendarUrl: resolvedCalendarUrl ?? c.url,
      fetchedAt: (lastSyncAt ?? new Date()).toISOString(),
    };
  }

  const authHeader = buildBasicAuthHeader(c.username, c.password);
  const calendarUrl = await resolveCalendarCollectionUrl(authHeader);
  const query = buildCalendarQuery(start, end);
  const report = await calDavRequest(calendarUrl, 'REPORT', authHeader, query, 1);

  if (!report.ok) {
    lastSyncError = `CalDAV REPORT failed (${report.status}). Check CALDAV_URL and credentials.`;
    throw new Error(lastSyncError);
  }

  const blocks = extractCalendarDataBlocks(report.text);
  const parsed: CalDavEvent[] = [];
  for (const block of blocks) {
    for (const event of parseVeventsFromIcs(block.ics, block.href)) {
      if (eventOverlapsRange(event, start, end)) parsed.push(event);
    }
  }

  parsed.sort((a, b) => a.dtStart.getTime() - b.dtStart.getTime());
  cacheKey = key;
  cacheEvents = parsed;
  cacheExpiresAt = now + CACHE_TTL_MS;
  lastSyncAt = new Date();
  lastSyncError = null;
  lastEventCount = parsed.length;
  resolvedCalendarUrl = calendarUrl;

  return {
    events: parsed,
    calendarUrl,
    fetchedAt: lastSyncAt.toISOString(),
  };
}

export function getCalDavSyncDiagnostics(): CalDavSyncDiagnostics {
  const configured = isCalDavConfigured();
  if (!configured) {
    return {
      configured: false,
      syncReady: false,
      implementation: 'none',
      url: null,
      calendarUrl: null,
      message: 'Set CALDAV_URL, CALDAV_USERNAME, and CALDAV_PASSWORD to enable calendar sync.',
      lastSyncAt: null,
      lastSyncError: null,
      eventCount: 0,
    };
  }

  if (lastSyncError) {
    return {
      configured: true,
      syncReady: false,
      implementation: 'error',
      url: calDavConfig().url,
      calendarUrl: resolvedCalendarUrl,
      message: lastSyncError,
      lastSyncAt: lastSyncAt?.toISOString() ?? null,
      lastSyncError,
      eventCount: lastEventCount,
    };
  }

  return {
    configured: true,
    syncReady: true,
    implementation: 'live',
    url: calDavConfig().url,
    calendarUrl: resolvedCalendarUrl,
    message: resolvedCalendarUrl
      ? `CalDAV sync active (${resolvedCalendarUrl}).`
      : 'CalDAV credentials configured. Events load on first calendar fetch.',
    lastSyncAt: lastSyncAt?.toISOString() ?? null,
    lastSyncError: null,
    eventCount: lastEventCount,
  };
}

export function resetCalDavClientState(): void {
  resolvedCalendarUrl = null;
  lastSyncAt = null;
  lastSyncError = null;
  lastEventCount = 0;
  cacheKey = '';
  cacheExpiresAt = 0;
  cacheEvents = [];
}

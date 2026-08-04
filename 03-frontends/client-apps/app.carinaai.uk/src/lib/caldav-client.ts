export interface CalDavCredentials {
  url: string;
  username: string;
  password: string;
  principalUrl?: string;
}

export interface CalDavEvent {
  uid: string;
  summary: string;
  dtStart: Date;
  dtEnd?: Date;
  allDay: boolean;
  href?: string;
  description?: string;
}

function buildBasicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function formatCalDavUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function unfoldIcsLines(text: string): string[] {
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

function parseIcsDateValue(value: string, params: string): { date: Date; allDay: boolean } {
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

function parseVeventsFromIcs(icsText: string, href?: string): CalDavEvent[] {
  const events: CalDavEvent[] = [];
  const blocks = icsText.split(/BEGIN:VEVENT/i);
  for (const block of blocks.slice(1)) {
    const body = block.split(/END:VEVENT/i)[0] ?? '';
    const lines = unfoldIcsLines(body);
    let uid = '';
    let summary = 'Event';
    let description = '';
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
      if (key === 'DESCRIPTION') description = value.replace(/\\n/g, '\n');
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
    events.push({ uid, summary, description, dtStart, dtEnd, allDay, href });
  }
  return events;
}

function extractCalendarDataBlocks(xml: string): Array<{ href?: string; ics: string }> {
  const blocks: Array<{ href?: string; ics: string }> = [];
  const responseChunks = xml.split(/<(?:[a-zA-Z0-9]+:)?response\b/i);
  for (const chunk of responseChunks.slice(1)) {
    const hrefMatch = chunk.match(/<(?:[a-zA-Z0-9]+:)?href[^>]*>([^<]+)<\/(?:[a-zA-Z0-9]+:)?href>/i);
    const href = hrefMatch?.[1]?.trim();
    const dataMatch = chunk.match(
      /<(?:[a-zA-Z0-9]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?calendar-data>/i,
    );
    if (!dataMatch?.[1]) continue;
    const ics = dataMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
    if (ics.includes('BEGIN:VCALENDAR')) blocks.push({ href, ics });
  }
  return blocks;
}

function extractHrefFromProp(xml: string, propName: string): string | null {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9]+:)?${propName}[^>]*>\\s*<(?:[a-zA-Z0-9]+:)?href[^>]*>([^<]+)<\\/(?:[a-zA-Z0-9]+:)?href>`,
    'i',
  );
  const match = xml.match(re);
  return match?.[1]?.trim() ?? null;
}

function extractCalendarCollectionHrefs(xml: string): string[] {
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
  if (body) headers['Content-Type'] = 'application/xml; charset=utf-8';
  if (depth !== undefined) headers.Depth = String(depth);

  const response = await fetch(url, { method, headers, body });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

const PROPFIND_RESOURCETYPE = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:resourcetype/><D:displayname/></D:prop>
</D:propfind>`;

const PROPFIND_HOME = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-home-set/><D:current-user-principal/></D:prop>
</D:propfind>`;

function buildCalendarQuery(start: Date, end: Date): string {
  return `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
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

async function discoverCalendarUrl(creds: CalDavCredentials, authHeader: string): Promise<string> {
  const candidates: string[] = [];
  if (creds.principalUrl) candidates.push(creds.principalUrl);
  if (creds.url) candidates.push(creds.url);

  for (const candidate of candidates) {
    const base = candidate.endsWith('/') ? candidate : `${candidate}/`;
    const homeRes = await calDavRequest(base, 'PROPFIND', authHeader, PROPFIND_HOME, 0);
    if (!homeRes.ok) continue;

    const homeHref =
      extractHrefFromProp(homeRes.text, 'calendar-home-set') ??
      extractHrefFromProp(homeRes.text, 'current-user-principal');
    if (!homeHref) continue;

    const homeUrl = joinUrl(base, homeHref);
    const listRes = await calDavRequest(homeUrl, 'PROPFIND', authHeader, PROPFIND_RESOURCETYPE, 1);
    if (!listRes.ok) continue;

    const collections = extractCalendarCollectionHrefs(listRes.text);
    if (collections.length) {
      return collections.find((href) => /personal|default|calendar/i.test(href)) ?? collections[0];
    }
  }

  if (creds.url) {
    const direct = creds.url.endsWith('/') ? creds.url : `${creds.url}/`;
    if (await isCalendarCollection(direct, authHeader)) return direct;
  }

  throw new Error(
    'Could not resolve a CalDAV calendar collection. Set the calendar collection URL or principal URL.',
  );
}

async function resolveCalendarCollectionUrl(
  creds: CalDavCredentials,
  authHeader: string,
): Promise<string> {
  if (creds.url) {
    const direct = creds.url.endsWith('/') ? creds.url : `${creds.url}/`;
    if (await isCalendarCollection(direct, authHeader)) return direct;
  }
  return discoverCalendarUrl(creds, authHeader);
}

function eventOverlapsRange(event: CalDavEvent, start: Date, end: Date): boolean {
  const eventEnd = event.dtEnd ?? event.dtStart;
  return event.dtStart <= end && eventEnd >= start;
}

export async function testCalDavConnection(creds: CalDavCredentials): Promise<{
  ok: boolean;
  calendarUrl?: string;
  error?: string;
}> {
  if (!creds.url?.trim() || !creds.username?.trim() || !creds.password) {
    return { ok: false, error: 'URL, username, and password are required.' };
  }

  try {
    const authHeader = buildBasicAuthHeader(creds.username, creds.password);
    const calendarUrl = await resolveCalendarCollectionUrl(creds, authHeader);
    return { ok: true, calendarUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchCalDavEventsInRange(
  creds: CalDavCredentials,
  start: Date,
  end: Date,
): Promise<{ events: CalDavEvent[]; calendarUrl: string }> {
  const authHeader = buildBasicAuthHeader(creds.username, creds.password);
  const calendarUrl = await resolveCalendarCollectionUrl(creds, authHeader);
  const query = buildCalendarQuery(start, end);
  const report = await calDavRequest(calendarUrl, 'REPORT', authHeader, query, 1);

  if (!report.ok) {
    throw new Error(`CalDAV REPORT failed (${report.status}). Check URL and credentials.`);
  }

  const blocks = extractCalendarDataBlocks(report.text);
  const parsed: CalDavEvent[] = [];
  for (const block of blocks) {
    for (const event of parseVeventsFromIcs(block.ics, block.href)) {
      if (eventOverlapsRange(event, start, end)) parsed.push(event);
    }
  }

  parsed.sort((a, b) => a.dtStart.getTime() - b.dtStart.getTime());
  return { events: parsed, calendarUrl };
}

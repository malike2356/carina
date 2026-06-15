import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  buildBasicAuthHeader,
  extractCalendarDataBlocks,
  extractCalendarCollectionHrefs,
  formatCalDavUtc,
  parseIcsDateValue,
  parseVeventsFromIcs,
  resetCalDavClientState,
  unfoldIcsLines,
} from './caldav-client.js';

describe('caldav-client parsing', () => {
  beforeEach(() => {
    resetCalDavClientState();
  });

  it('builds basic auth header', () => {
    expect(buildBasicAuthHeader('alice', 'secret')).toBe(`Basic ${Buffer.from('alice:secret').toString('base64')}`);
  });

  it('formats UTC timestamps for CalDAV time-range', () => {
    const date = new Date('2026-06-15T14:30:00.000Z');
    expect(formatCalDavUtc(date)).toBe('20260615T143000Z');
  });

  it('unfolds folded ICS lines per RFC 5545', () => {
    const lines = unfoldIcsLines('SUMMARY:Long line\r\n continued\r\nUID:abc');
    expect(lines[0]).toBe('SUMMARY:Long linecontinued');
    expect(lines[1]).toBe('UID:abc');
  });

  it('parses datetime and all-day ICS values', () => {
    const dt = parseIcsDateValue('20260620T100000Z', '');
    expect(dt.allDay).toBe(false);
    expect(dt.date.toISOString()).toBe('2026-06-20T10:00:00.000Z');

    const allDay = parseIcsDateValue('20260620', 'VALUE=DATE');
    expect(allDay.allDay).toBe(true);
    expect(allDay.date.toISOString()).toBe('2026-06-20T00:00:00.000Z');
  });

  it('parses VEVENT blocks from ICS', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-1
SUMMARY:Site visit
DTSTART:20260620T100000Z
DTEND:20260620T110000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseVeventsFromIcs(ics, '/cal/event.ics');
    expect(events).toHaveLength(1);
    expect(events[0]?.summary).toBe('Site visit');
    expect(events[0]?.uid).toBe('evt-1');
    expect(events[0]?.href).toBe('/cal/event.ics');
  });

  it('extracts calendar-data from multistatus XML', () => {
    const xml = `<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/dav/event1.ics</D:href>
    <D:propstat>
      <D:prop>
        <C:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-2
SUMMARY:Meeting
DTSTART:20260621T090000Z
END:VEVENT
END:VCALENDAR</C:calendar-data>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;
    const blocks = extractCalendarDataBlocks(xml);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.href).toBe('/dav/event1.ics');
    expect(parseVeventsFromIcs(blocks[0]?.ics ?? '')).toHaveLength(1);
  });

  it('finds calendar collection hrefs in PROPFIND responses', () => {
    const xml = `<D:response>
      <D:href>/dav/calendars/user/personal/</D:href>
      <D:propstat><D:prop><D:resourcetype><C:calendar/></D:resourcetype></D:prop></D:propstat>
    </D:response>`;
    expect(extractCalendarCollectionHrefs(xml)).toEqual(['/dav/calendars/user/personal/']);
  });
});

describe('caldav-client fetch', () => {
  beforeEach(() => {
    resetCalDavClientState();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('fetches events via CalDAV REPORT when configured', async () => {
    vi.doMock('../config/index.js', () => ({
      config: {
        caldav: {
          url: 'https://caldav.example.com/dav/user/personal/',
          username: 'user',
          password: 'pass',
          principalUrl: '',
        },
      },
    }));

    const reportXml = `<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response>
    <D:href>/dav/user/personal/event.ics</D:href>
    <D:propstat>
      <D:prop>
        <C:calendar-data>BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-3
SUMMARY:Inspection
DTSTART:20260622T120000Z
END:VEVENT
END:VCALENDAR</C:calendar-data>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = String(init?.body ?? '');
      if (method === 'PROPFIND') {
        return new Response(`<D:multistatus><D:response><D:propstat><D:prop><D:resourcetype><C:calendar/></D:resourcetype></D:prop></D:propstat></D:response></D:multistatus>`, { status: 207 });
      }
      if (method === 'REPORT' && body.includes('calendar-query')) {
        return new Response(reportXml, { status: 207 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchCalDavEventsInRange } = await import('./caldav-client.js');
    const start = new Date('2026-06-01T00:00:00.000Z');
    const end = new Date('2026-06-30T23:59:59.999Z');
    const result = await fetchCalDavEventsInRange(start, end);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.summary).toBe('Inspection');
    expect(fetchMock).toHaveBeenCalled();
  });
});

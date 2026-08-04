import crypto from 'crypto';
import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { invokeProductTool } from '../workers/product-tools/invoke.js';
import {
  createBooking,
  buildBookingConfirmationEmail,
  getBookingConfig,
  cancelBooking,
  listAvailability,
  rescheduleBooking,
  sendBookingConfirmationEmail,
  updateBookingConfig,
} from '../outreach/bookings.js';
import { getLead } from '../outreach/leads.js';

type BusyWindow = { start: string; end: string };

function resolveWorkspace(sessionId: string): { workspaceId: string; workerId: string } | null {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) return null;
  return { workspaceId: ctx.worker.workspaceId, workerId: ctx.worker.id };
}

function parseBusyWindows(data: unknown): BusyWindow[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as { items?: Array<Record<string, unknown>> }).items;
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const start = item.start as { dateTime?: string; date?: string } | undefined;
    const end = item.end as { dateTime?: string; date?: string } | undefined;
    return {
      start: start?.dateTime ?? start?.date ?? '',
      end: end?.dateTime ?? end?.date ?? '',
    };
  }).filter((row) => Boolean(row.start && row.end));
}

async function fetchCalendarBusyWindows(input: {
  workspaceId: string;
  workerId: string;
  from: string;
  to: string;
}): Promise<BusyWindow[]> {
  const result = await invokeProductTool({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    slug: 'google-calendar',
    action: 'list',
    input: {
      timeMin: input.from,
      timeMax: input.to,
      maxResults: 50,
    },
  });
  if (!result.ok) return [];
  const data = result.data as { items?: Array<Record<string, unknown>> } | undefined;
  return parseBusyWindows(data);
}

function bookingDescription(input: {
  leadName: string;
  leadEmail?: string;
  slotStart: string;
  slotEnd: string;
  note?: string;
  joinLink?: string;
}): string {
  return [
    `Lead: ${input.leadName}`,
    input.leadEmail ? `Email: ${input.leadEmail}` : '',
    `Start: ${input.slotStart}`,
    `End: ${input.slotEnd}`,
    input.joinLink ? `Join: ${input.joinLink}` : '',
    input.note ? `Note: ${input.note}` : '',
  ].filter(Boolean).join('\n');
}

export function createOutreachBookingTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-booking-config-get',
      description: 'Read the current discovery booking configuration for this workspace.',
      parameters: { type: 'object', properties: { workspaceId: { type: 'string' } } },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return { ok: true, data: getBookingConfig(workspaceId) };
      },
    },
    {
      name: 'outreach-booking-config-update',
      description: 'Update discovery booking availability and meeting preferences for this workspace.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          timezone: { type: 'string' },
          slotMinutes: { type: 'number' },
          bufferMinutes: { type: 'number' },
          horizonDays: { type: 'number' },
          reminderOffsetsMinutes: { type: 'array' },
          windows: { type: 'array' },
          blockedDates: { type: 'array' },
          meetingMode: { type: 'string', enum: ['google_meet', 'zoom'] },
          zoomRoomUrl: { type: 'string' },
          prepVideoUrl: { type: 'string' },
          prepVideoTitle: { type: 'string' },
          prepVideoPassword: { type: 'string' },
        },
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const config = updateBookingConfig(workspaceId, {
          timezone: typeof params.timezone === 'string' ? params.timezone : undefined,
          slotMinutes: typeof params.slotMinutes === 'number' ? params.slotMinutes : undefined,
          bufferMinutes: typeof params.bufferMinutes === 'number' ? params.bufferMinutes : undefined,
          horizonDays: typeof params.horizonDays === 'number' ? params.horizonDays : undefined,
          reminderOffsetsMinutes: Array.isArray(params.reminderOffsetsMinutes) ? params.reminderOffsetsMinutes as never : undefined,
          windows: Array.isArray(params.windows) ? params.windows as never : undefined,
          blockedDates: Array.isArray(params.blockedDates) ? params.blockedDates as never : undefined,
          meetingMode: typeof params.meetingMode === 'string' ? params.meetingMode as 'google_meet' | 'zoom' : undefined,
          zoomRoomUrl: typeof params.zoomRoomUrl === 'string' ? params.zoomRoomUrl : undefined,
          prepVideoUrl: typeof params.prepVideoUrl === 'string' ? params.prepVideoUrl : undefined,
          prepVideoTitle: typeof params.prepVideoTitle === 'string' ? params.prepVideoTitle : undefined,
          prepVideoPassword: typeof params.prepVideoPassword === 'string' ? params.prepVideoPassword : undefined,
        });
        return { ok: true, data: config };
      },
    },
    {
      name: 'outreach-booking-offer-slots',
      description: 'Offer the next free discovery call slots for a lead, using calendar busy time when available.',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          workspaceId: { type: 'string' },
          workerId: { type: 'string' },
          from: { type: 'string' },
          days: { type: 'number' },
          limit: { type: 'number' },
        },
        required: ['leadId'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        const workerId = typeof params.workerId === 'string' ? params.workerId.trim() : ctx?.workerId ?? '';
        const leadId = String(params.leadId ?? '').trim();
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        if (!leadId) return { ok: false, error: 'leadId required' };
        const lead = getLead(workspaceId, leadId);
        if (!lead) return { ok: false, error: 'lead not found' };
        const config = getBookingConfig(workspaceId);
        const from = String(params.from ?? new Date().toISOString()).trim();
        const days = Math.max(1, Math.min(21, Number(params.days ?? config.horizonDays ?? 14) || 14));
        const limit = Math.max(1, Math.min(20, Number(params.limit ?? 5) || 5));
        const to = new Date(new Date(from).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
        const remoteBusy = workerId
          ? await fetchCalendarBusyWindows({ workspaceId, workerId, from, to })
          : [];
        const slots = listAvailability({
          workspaceId,
          from: new Date(from),
          days,
          slotMinutes: config.slotMinutes,
          timezone: config.timezone,
          busyWindows: remoteBusy,
          businessHoursStart: config.windows[0]?.start ?? '09:00',
          businessHoursEnd: config.windows[0]?.end ?? '17:00',
          businessDays: Array.from(new Set(config.windows.map((w) => w.dayOfWeek))).sort((a, b) => a - b),
        }).slice(0, limit);
        return { ok: true, data: { leadId, slots, config } };
      },
    },
    {
      name: 'outreach-booking-confirm',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Confirm a discovery call booking, create the calendar event, and record it via the merged viCal booking engine (outreach mirror keeps Kanban/reminders).',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string' },
          startsAt: { type: 'string' },
          endsAt: { type: 'string' },
          workspaceId: { type: 'string' },
          workerId: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['leadId', 'startsAt', 'endsAt'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        const workerId = typeof params.workerId === 'string' ? params.workerId.trim() : ctx?.workerId ?? '';
        const leadId = String(params.leadId ?? '').trim();
        const startsAt = String(params.startsAt ?? '').trim();
        const endsAt = String(params.endsAt ?? '').trim();
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        if (!workerId) return { ok: false, error: 'workerId required' };
        if (!leadId || !startsAt || !endsAt) return { ok: false, error: 'leadId, startsAt, and endsAt required' };

        const lead = getLead(workspaceId, leadId);
        if (!lead) return { ok: false, error: 'lead not found' };
        const config = getBookingConfig(workspaceId);
        const busy = await fetchCalendarBusyWindows({ workspaceId, workerId, from: startsAt, to: endsAt });
        const conflict = busy.some((window) =>
          new Date(window.start).getTime() < new Date(endsAt).getTime()
          && new Date(startsAt).getTime() < new Date(window.end).getTime(),
        );
        if (conflict) return { ok: false, error: 'Slot just filled; choose another time' };

        const description = bookingDescription({
          leadName: lead.name,
          leadEmail: lead.email,
          slotStart: startsAt,
          slotEnd: endsAt,
          note: typeof params.note === 'string' ? params.note : undefined,
        });
        const googleCalendarPayload: Record<string, unknown> = {
          summary: `Discovery call with ${lead.name}`,
          start: startsAt,
          end: endsAt,
          description,
        };
        if (config.meetingMode === 'google_meet') {
          googleCalendarPayload.conferenceData = {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          };
        } else if (config.zoomRoomUrl) {
          googleCalendarPayload.location = config.zoomRoomUrl;
        }
        if (lead.email) {
          googleCalendarPayload.attendees = [{ email: lead.email, responseStatus: 'accepted' }];
        }

        const calendar = await invokeProductTool({
          workspaceId,
          workerId,
          slug: 'google-calendar',
          action: 'create',
          input: googleCalendarPayload,
        });
        if (!calendar.ok) {
          return { ok: false, error: calendar.error ?? 'calendar create failed' };
        }

        const calendarData = (calendar.data ?? {}) as Record<string, unknown>;
        const joinLink =
          typeof (calendarData.hangoutLink) === 'string'
            ? String(calendarData.hangoutLink)
            : typeof (calendarData.htmlLink) === 'string'
              ? String(calendarData.htmlLink)
              : config.zoomRoomUrl;
        const booking = createBooking({
          workspaceId,
          leadId,
          startsAt,
          endsAt,
          timezone: config.timezone,
          hostEmail: workerId ? undefined : undefined,
          hostName: undefined,
          calendarProvider: 'google',
          calendarEventId: typeof calendarData.id === 'string' ? calendarData.id : undefined,
          joinLink,
          notes: typeof params.note === 'string' ? params.note : undefined,
          busyWindows: busy,
        });
        const confirmationCopy = buildBookingConfirmationEmail({
          leadName: lead.name,
          startsAt,
          endsAt,
          timezone: config.timezone,
          joinLink,
          prepVideoUrl: config.prepVideoUrl,
          prepVideoTitle: config.prepVideoTitle,
          prepVideoPassword: config.prepVideoPassword,
        });
        const confirmation = lead.email
          ? await sendBookingConfirmationEmail({
            workspaceId,
            bookingId: booking.id,
            workerId,
            prepVideoUrl: config.prepVideoUrl,
            prepVideoTitle: config.prepVideoTitle,
            prepVideoPassword: config.prepVideoPassword,
          })
          : { sent: false, skipped: false, warning: 'Booking created, but no attendee email was available for confirmation.', booking };
        let warning: string | undefined = confirmation.warning;
        if (!config.prepVideoUrl) {
          warning = warning
            ? `${warning} Prep video URL is missing; set prepVideoUrl in booking config.`
            : 'Prep video URL is missing; set prepVideoUrl in booking config.';
        }
        return {
          ok: true,
          data: {
            booking: confirmation.booking ?? booking,
            calendar: calendar.data,
            confirmationCopy,
            confirmation,
            warning,
          },
        };
      },
    },
    {
      name: 'outreach-booking-reschedule',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Reschedule an existing booking to a new slot and return the updated record.',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          startsAt: { type: 'string' },
          endsAt: { type: 'string' },
          workspaceId: { type: 'string' },
        },
        required: ['bookingId', 'startsAt', 'endsAt'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        const bookingId = String(params.bookingId ?? '').trim();
        const startsAt = String(params.startsAt ?? '').trim();
        const endsAt = String(params.endsAt ?? '').trim();
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        if (!bookingId || !startsAt || !endsAt) return { ok: false, error: 'bookingId, startsAt, and endsAt required' };
        try {
          const booking = rescheduleBooking({
            workspaceId,
            bookingId,
            startsAt,
            endsAt,
          });
          return { ok: true, data: booking };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    },
    {
      name: 'outreach-booking-cancel',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Cancel an existing booking and cancel its reminder jobs.',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          workspaceId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['bookingId'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        const bookingId = String(params.bookingId ?? '').trim();
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        if (!bookingId) return { ok: false, error: 'bookingId required' };
        try {
          const booking = cancelBooking(workspaceId, bookingId, typeof params.reason === 'string' ? params.reason : undefined);
          return { ok: true, data: booking };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    },
  ];
}

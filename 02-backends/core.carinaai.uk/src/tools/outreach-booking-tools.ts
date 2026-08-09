import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { invokeProductTool } from '../workers/product-tools/invoke.js';
import {
  buildBookingConfirmationEmail,
  getBookingConfig,
  cancelBooking,
  listAvailability,
  recordPostCallOutcome,
  rescheduleBooking,
  updateBookingConfig,
} from '../outreach/bookings.js';
import { getLead } from '../outreach/leads.js';
import { recordLeadBooking } from '../outreach/sequence-engine.js';
import {
  deleteBookingGoogleCalendar,
  updateBookingGoogleCalendar,
} from '../vical/calendar-sync.js';
import { formatBookingIcs } from '../vical/ics.js';
import {
  bookWithSaga,
  ensureDiscoveryDefaults,
  getBooking as getVicalBooking,
} from '../vical/index.js';

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

        void bookingDescription({
          leadName: lead.name,
          leadEmail: lead.email,
          slotStart: startsAt,
          slotEnd: endsAt,
          note: typeof params.note === 'string' ? params.note : undefined,
        });

        // Prompt 706: never soft-confirm. Provider-neutral saga owns Zoom + calendar honesty.
        const { eventType } = ensureDiscoveryDefaults({
          workspaceId,
          hostUserId: workerId,
        });
        const saga = await bookWithSaga({
          workspaceId,
          workerId,
          eventTypeId: eventType.id,
          guestName: lead.name,
          guestEmail: lead.email || `${lead.id}@outreach.local`,
          startsAt,
          endsAt,
          timezone: config.timezone,
          source: 'outreach',
          leadId,
          notes: typeof params.note === 'string' ? params.note : undefined,
          staticRoomUrl: config.meetingMode === 'zoom' ? config.zoomRoomUrl : undefined,
          externalBusy: busy,
          preferManagedZoom: config.meetingMode === 'zoom' && !config.zoomRoomUrl,
        });

        const vicalRow = getVicalBooking(workspaceId, saga.booking.id) ?? saga.booking;
        if (!saga.actionRequired) {
          recordLeadBooking(workspaceId, leadId);
        }

        const joinLink = vicalRow.meetingUrl ?? config.zoomRoomUrl;
        const confirmationCopy = buildBookingConfirmationEmail({
          leadName: lead.name,
          startsAt: vicalRow.startsAt,
          endsAt: vicalRow.endsAt,
          timezone: config.timezone,
          joinLink,
          prepVideoUrl: config.prepVideoUrl,
          prepVideoTitle: config.prepVideoTitle,
          prepVideoPassword: config.prepVideoPassword,
        });
        const ics = formatBookingIcs(vicalRow);

        // Confirmation email is Soft Wall approved; do not claim provider delivery here.
        let confirmation: {
          sent: boolean;
          skipped: boolean;
          warning?: string;
          booking: typeof vicalRow;
        } = {
          sent: false,
          skipped: true,
          warning: saga.actionRequired
            ? 'Booking is action_required; confirmation email withheld until providers succeed.'
            : lead.email
              ? 'Confirmation draft prepared; Soft Wall approval still required before send.'
              : 'Booking created, but no attendee email was available for confirmation.',
          booking: vicalRow,
        };
        if (!saga.actionRequired && lead.email) {
          confirmation = {
            sent: false,
            skipped: false,
            warning: 'Confirmation draft prepared; Soft Wall approval still required before send.',
            booking: vicalRow,
          };
        }

        let warning: string | undefined = confirmation.warning;
        if (saga.actionRequired) {
          warning = warning
            ? `${warning} Orchestration status is action_required.`
            : 'Orchestration status is action_required; not a fully confirmed meeting.';
        }
        if (!config.prepVideoUrl) {
          warning = warning
            ? `${warning} Prep video URL is missing; set prepVideoUrl in booking config.`
            : 'Prep video URL is missing; set prepVideoUrl in booking config.';
        }

        return {
          ok: !saga.actionRequired,
          error: saga.actionRequired
            ? 'Booking needs operator action (join method and/or calendar invitation incomplete).'
            : undefined,
          data: {
            booking: vicalRow,
            publicBooking: saga.publicBooking,
            actionRequired: saga.actionRequired,
            conferenceManaged: saga.conferenceManaged,
            orchestrationStatus: vicalRow.orchestrationStatus,
            invitationDeliveryState: vicalRow.invitationDeliveryState ?? null,
            calendarSync: {
              ok: Boolean(vicalRow.calendarEventId) && vicalRow.invitationDeliveryState !== 'failed',
              status: vicalRow.calendarSyncStatus,
              error: vicalRow.calendarSyncError,
            },
            providerOperations: saga.providerOperations.map((op) => ({
              provider: op.provider,
              action: op.action,
              status: op.status,
              errorCode: op.errorCode,
              errorMessage: op.errorMessage,
            })),
            confirmationCopy,
            confirmation,
            ics,
            warning,
          },
        };
      },
    },
    {
      name: 'outreach-booking-outcome',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Record the post-call outcome for a discovery booking, update the lead pipeline, and schedule the right next action.',
      parameters: {
        type: 'object',
        properties: {
          bookingId: { type: 'string' },
          outcome: {
            type: 'string',
            enum: ['qualified', 'proposal_needed', 'needs_follow_up', 'not_a_fit', 'won', 'lost'],
          },
          notes: { type: 'string' },
          workspaceId: { type: 'string' },
        },
        required: ['bookingId', 'outcome'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        const bookingId = String(params.bookingId ?? '').trim();
        const outcome = String(params.outcome ?? '').trim();
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        if (!bookingId) return { ok: false, error: 'bookingId required' };
        if (!['qualified', 'proposal_needed', 'needs_follow_up', 'not_a_fit', 'won', 'lost'].includes(outcome)) {
          return { ok: false, error: 'outcome required' };
        }
        const result = recordPostCallOutcome({
          workspaceId,
          bookingId,
          outcome: outcome as 'qualified' | 'proposal_needed' | 'needs_follow_up' | 'not_a_fit' | 'won' | 'lost',
          notes: typeof params.notes === 'string' ? params.notes : undefined,
        });
        return { ok: true, data: result };
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
          const workerId = ctx?.workerId ?? '';
          let warning: string | undefined;
          if (workerId) {
            const sync = await updateBookingGoogleCalendar({
              workspaceId,
              workerId,
              bookingId: booking.id,
            });
            warning = sync.warning;
          }
          return { ok: true, data: booking, warning };
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
          const workerId = ctx?.workerId ?? '';
          let warning: string | undefined;
          if (workerId) {
            const sync = await deleteBookingGoogleCalendar({
              workspaceId,
              workerId,
              bookingId,
            });
            warning = sync.warning;
          }
          return { ok: true, data: booking, warning };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    },
  ];
}

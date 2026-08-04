import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { invokeProductTool } from '../workers/product-tools/invoke.js';
import {
  cancelBookingForHost,
  createBooking,
  createFromOutreach,
  ensureDiscoveryDefaults,
  getBooking,
  isVcalError,
  listBookings,
  listEventTypes,
  listOfferedSlots,
  readConfigAsOutreach,
  rescheduleBooking,
  SlotUnavailableError,
  syncConfigFromOutreach,
  updateEventType,
} from '../vical/index.js';
import type { BookingConfig } from '../outreach/types.js';
import { getBookingConfig, updateBookingConfig } from '../outreach/bookings.js';

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
  return items
    .map((item) => {
      const start = item.start as { dateTime?: string; date?: string } | undefined;
      const end = item.end as { dateTime?: string; date?: string } | undefined;
      return {
        start: start?.dateTime ?? start?.date ?? '',
        end: end?.dateTime ?? end?.date ?? '',
      };
    })
    .filter((row) => Boolean(row.start && row.end));
}

function toolError(error: unknown): { ok: false; error: string; code?: string; alternatives?: unknown } {
  if (error instanceof SlotUnavailableError) {
    return { ok: false, error: error.message, code: error.code, alternatives: error.alternatives };
  }
  if (isVcalError(error)) return { ok: false, error: error.message, code: error.code };
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

/**
 * Canonical viCal tools. Outreach booking tools stay registered as aliases that call the same engine
 * when VICAL_OUTREACH_BACKEND=vical (see product-tool-adapters comment).
 */
export function createVicalBookingTools(sessionId: string): Tool[] {
  return [
    {
      name: 'vical-event-types-list',
      description: 'List active viCal event types (booking products) for this workspace.',
      parameters: { type: 'object', properties: { workspaceId: { type: 'string' } } },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        ensureDiscoveryDefaults({ workspaceId, hostUserId: ctx?.workerId ?? 'default-host' });
        return { ok: true, data: listEventTypes(workspaceId, { activeOnly: true }) };
      },
    },
    {
      name: 'vical-slots-offer',
      description:
        'Offer free viCal slots for an event type. Uses local rules even if Google Calendar is disconnected (degraded mode). When Calendar is connected, busy events are subtracted.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          eventTypeId: { type: 'string' },
          limit: { type: 'number' },
          from: { type: 'string' },
        },
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const hostUserId = ctx?.workerId ?? 'default-host';
        const { eventType } = ensureDiscoveryDefaults({ workspaceId, hostUserId });
        const eventTypeId =
          typeof params.eventTypeId === 'string' && params.eventTypeId.trim()
            ? params.eventTypeId.trim()
            : eventType.id;
        const from = typeof params.from === 'string' && params.from ? new Date(params.from) : new Date();
        const horizonDays = 14;
        const to = new Date(from.getTime() + horizonDays * 24 * 60 * 60 * 1000);
        let externalBusy: BusyWindow[] = [];
        let calendarMode: 'google_plus_local' | 'local_only' = 'local_only';
        if (ctx) {
          const result = await invokeProductTool({
            workspaceId: ctx.workspaceId,
            workerId: ctx.workerId,
            slug: 'google-calendar',
            action: 'list',
            input: {
              timeMin: from.toISOString(),
              timeMax: to.toISOString(),
              maxResults: 50,
            },
          });
          if (result.ok) {
            externalBusy = parseBusyWindows(result.data);
            calendarMode = 'google_plus_local';
          }
        }
        try {
          const slots = listOfferedSlots({
            workspaceId,
            eventTypeId,
            limit: typeof params.limit === 'number' ? params.limit : 5,
            from,
            externalBusy,
          });
          return {
            ok: true,
            data: {
              slots,
              calendarMode,
              note: 'Missing Google Calendar still allows local availability rules.',
            },
          };
        } catch (error) {
          return toolError(error);
        }
      },
    },
    {
      name: 'vical-booking-create',
      description: 'Create a viCal booking for a guest email at a chosen start time.',
      dangerous: true,
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          eventTypeId: { type: 'string' },
          guestName: { type: 'string' },
          guestEmail: { type: 'string' },
          startsAt: { type: 'string' },
          leadId: { type: 'string' },
          notes: { type: 'string' },
          meetingUrl: { type: 'string' },
        },
        required: ['guestEmail', 'startsAt'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const hostUserId = ctx?.workerId ?? 'default-host';
        const { eventType } = ensureDiscoveryDefaults({ workspaceId, hostUserId });
        const guestEmail = String(params.guestEmail ?? '').trim();
        const startsAt = String(params.startsAt ?? '').trim();
        if (!guestEmail || !startsAt) return { ok: false, error: 'guestEmail and startsAt required' };
        try {
          const leadId = typeof params.leadId === 'string' ? params.leadId.trim() : '';
          const booking = leadId
            ? createFromOutreach({
                workspaceId,
                leadId,
                email: guestEmail,
                name: String(params.guestName ?? guestEmail),
                startsAt,
                eventTypeId:
                  typeof params.eventTypeId === 'string' && params.eventTypeId.trim()
                    ? params.eventTypeId.trim()
                    : eventType.id,
                notes: typeof params.notes === 'string' ? params.notes : undefined,
                meetingUrl: typeof params.meetingUrl === 'string' ? params.meetingUrl : undefined,
              })
            : createBooking({
                workspaceId,
                eventTypeId:
                  typeof params.eventTypeId === 'string' && params.eventTypeId.trim()
                    ? params.eventTypeId.trim()
                    : eventType.id,
                guestName: String(params.guestName ?? guestEmail),
                guestEmail,
                startsAt,
                source: 'agent',
                notes: typeof params.notes === 'string' ? params.notes : undefined,
                meetingUrl: typeof params.meetingUrl === 'string' ? params.meetingUrl : undefined,
              });
          return { ok: true, data: booking };
        } catch (error) {
          return toolError(error);
        }
      },
    },
    {
      name: 'vical-booking-list',
      description: 'List viCal bookings for this workspace (optional filters).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          status: { type: 'string' },
          guestEmail: { type: 'string' },
          leadId: { type: 'string' },
        },
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return {
          ok: true,
          data: listBookings(workspaceId, {
            status: typeof params.status === 'string' ? (params.status as never) : undefined,
            guestEmail: typeof params.guestEmail === 'string' ? params.guestEmail : undefined,
            leadId: typeof params.leadId === 'string' ? params.leadId : undefined,
          }),
        };
      },
    },
    {
      name: 'vical-booking-cancel',
      description: 'Cancel a viCal booking by id.',
      dangerous: true,
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          bookingId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['bookingId'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        const bookingId = String(params.bookingId ?? '').trim();
        if (!workspaceId || !bookingId) return { ok: false, error: 'workspaceId and bookingId required' };
        try {
          return {
            ok: true,
            data: cancelBookingForHost(
              workspaceId,
              bookingId,
              typeof params.reason === 'string' ? params.reason : undefined,
            ),
          };
        } catch (error) {
          return toolError(error);
        }
      },
    },
    {
      name: 'vical-booking-reschedule',
      description: 'Reschedule a viCal booking to a new start time.',
      dangerous: true,
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          bookingId: { type: 'string' },
          startsAt: { type: 'string' },
        },
        required: ['bookingId', 'startsAt'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        const bookingId = String(params.bookingId ?? '').trim();
        const startsAt = String(params.startsAt ?? '').trim();
        if (!workspaceId || !bookingId || !startsAt) {
          return { ok: false, error: 'workspaceId, bookingId, and startsAt required' };
        }
        try {
          return {
            ok: true,
            data: rescheduleBooking({ workspaceId, bookingId, startsAt }),
          };
        } catch (error) {
          return toolError(error);
        }
      },
    },
    {
      name: 'vical-booking-config-get',
      description: 'Read discovery booking windows mapped from viCal (falls back to outreach config).',
      parameters: { type: 'object', properties: { workspaceId: { type: 'string' } } },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const hostUserId = ctx?.workerId ?? 'default-host';
        ensureDiscoveryDefaults({ workspaceId, hostUserId });
        const fromVical = readConfigAsOutreach(workspaceId, hostUserId);
        return { ok: true, data: fromVical ?? getBookingConfig(workspaceId) };
      },
    },
    {
      name: 'vical-booking-config-update',
      description: 'Update discovery windows on viCal and dual-write outreach BookingConfig during cutover.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          timezone: { type: 'string' },
          slotMinutes: { type: 'number' },
          bufferMinutes: { type: 'number' },
          horizonDays: { type: 'number' },
          windows: { type: 'array' },
          blockedDates: { type: 'array' },
          meetingMode: { type: 'string', enum: ['google_meet', 'zoom'] },
          zoomRoomUrl: { type: 'string' },
          prepVideoUrl: { type: 'string' },
          prepVideoTitle: { type: 'string' },
          prepVideoPassword: { type: 'string' },
          reminderOffsetsMinutes: { type: 'array' },
        },
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const hostUserId = ctx?.workerId ?? 'default-host';
        const patch: Partial<BookingConfig> = {
          timezone: typeof params.timezone === 'string' ? params.timezone : undefined,
          slotMinutes: typeof params.slotMinutes === 'number' ? params.slotMinutes : undefined,
          bufferMinutes: typeof params.bufferMinutes === 'number' ? params.bufferMinutes : undefined,
          horizonDays: typeof params.horizonDays === 'number' ? params.horizonDays : undefined,
          windows: Array.isArray(params.windows) ? (params.windows as BookingConfig['windows']) : undefined,
          blockedDates: Array.isArray(params.blockedDates) ? (params.blockedDates as string[]) : undefined,
          meetingMode:
            params.meetingMode === 'zoom' || params.meetingMode === 'google_meet'
              ? params.meetingMode
              : undefined,
          zoomRoomUrl: typeof params.zoomRoomUrl === 'string' ? params.zoomRoomUrl : undefined,
          prepVideoUrl: typeof params.prepVideoUrl === 'string' ? params.prepVideoUrl : undefined,
          prepVideoTitle: typeof params.prepVideoTitle === 'string' ? params.prepVideoTitle : undefined,
          prepVideoPassword: typeof params.prepVideoPassword === 'string' ? params.prepVideoPassword : undefined,
          reminderOffsetsMinutes: Array.isArray(params.reminderOffsetsMinutes)
            ? (params.reminderOffsetsMinutes as number[])
            : undefined,
        };
        const outreach = updateBookingConfig(workspaceId, patch);
        syncConfigFromOutreach(workspaceId, hostUserId, outreach);
        const discovery = listEventTypes(workspaceId).find((e) => e.slug === 'discovery-call');
        if (discovery && patch.meetingMode) {
          updateEventType(workspaceId, discovery.id, {
            locationMode: patch.meetingMode === 'zoom' ? 'zoom' : 'google_meet',
          });
        }
        return { ok: true, data: readConfigAsOutreach(workspaceId, hostUserId) ?? outreach };
      },
    },
    {
      name: 'vical-booking-get',
      description: 'Fetch one viCal booking by id.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' }, bookingId: { type: 'string' } },
        required: ['bookingId'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : ctx?.workspaceId ?? '';
        const bookingId = String(params.bookingId ?? '').trim();
        if (!workspaceId || !bookingId) return { ok: false, error: 'workspaceId and bookingId required' };
        const booking = getBooking(workspaceId, bookingId);
        if (!booking) return { ok: false, error: 'Booking not found' };
        return { ok: true, data: booking };
      },
    },
  ];
}

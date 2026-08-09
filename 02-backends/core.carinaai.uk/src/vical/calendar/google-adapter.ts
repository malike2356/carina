/**
 * Google Calendar adapter with explicit invitation sendUpdates (Prompt 704).
 */

import { invokeProductTool } from '../../workers/product-tools/invoke.js';
import { mapGoogleResponseToDelivery } from './delivery-state.js';
import type {
  CalendarAdapter,
  CalendarAdapterResult,
  CalendarAttendeeSnapshot,
  CalendarEventInput,
} from './types.js';

function parseAttendees(data: Record<string, unknown>): CalendarAttendeeSnapshot[] {
  const attendees = Array.isArray(data.attendees) ? data.attendees : [];
  return attendees
    .map((row) => {
      const item = row as Record<string, unknown>;
      const email = String(item.email ?? '').trim().toLowerCase();
      if (!email) return null;
      const mapped = mapGoogleResponseToDelivery(
        typeof item.responseStatus === 'string' ? item.responseStatus : undefined,
      );
      return {
        email,
        responseStatus: mapped.responseStatus,
        deliveryState: mapped.deliveryState,
      };
    })
    .filter((row): row is CalendarAttendeeSnapshot => Boolean(row));
}

function toResult(
  ok: boolean,
  data: Record<string, unknown> | null,
  error: string | undefined,
  invitationSendRequested: boolean,
): CalendarAdapterResult {
  if (!ok) {
    const retryable = /429|rate|quota|timeout|503|502/i.test(error ?? '');
    return {
      ok: false,
      status: retryable ? 'retryable' : 'failed',
      provider: 'google',
      attendees: [],
      invitationSendRequested,
      errorCode: retryable ? 'retryable' : 'api_error',
      errorMessage: error ?? 'google calendar failed',
      raw: data ?? undefined,
    };
  }
  const payload = data ?? {};
  return {
    ok: true,
    status: 'succeeded',
    provider: 'google',
    providerEventId: typeof payload.id === 'string' ? payload.id : null,
    etag: typeof payload.etag === 'string' ? payload.etag : null,
    htmlLink: typeof payload.htmlLink === 'string' ? payload.htmlLink : null,
    organizerEmail:
      typeof (payload.organizer as { email?: string } | undefined)?.email === 'string'
        ? (payload.organizer as { email: string }).email
        : null,
    attendees: parseAttendees(payload),
    invitationSendRequested,
    joinUrl:
      typeof payload.hangoutLink === 'string'
        ? payload.hangoutLink
        : typeof payload.htmlLink === 'string'
          ? payload.htmlLink
          : null,
    raw: payload,
  };
}

export class GoogleCalendarAdapter implements CalendarAdapter {
  readonly provider = 'google' as const;

  async createEvent(input: CalendarEventInput): Promise<CalendarAdapterResult> {
    const sendUpdates = input.sendUpdates ?? 'all';
    const result = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: 'google-calendar',
      action: 'create',
      input: {
        summary: input.summary,
        start: input.startsAt,
        end: input.endsAt,
        timezone: input.timezone,
        description: input.description,
        location: input.location,
        attendees: input.guestEmail
          ? [{ email: input.guestEmail, responseStatus: 'needsAction' }]
          : undefined,
        conferenceData: input.conferenceData,
        sendUpdates,
        bookingId: input.bookingId,
        workspaceId: input.workspaceId,
      },
    });
    return toResult(
      result.ok,
      (result.data ?? null) as Record<string, unknown> | null,
      result.error,
      sendUpdates !== 'none',
    );
  }

  async updateEvent(
    input: CalendarEventInput & { providerEventId: string },
  ): Promise<CalendarAdapterResult> {
    const sendUpdates = input.sendUpdates ?? 'all';
    const result = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: 'google-calendar',
      action: 'update',
      input: {
        eventId: input.providerEventId,
        summary: input.summary,
        start: input.startsAt,
        end: input.endsAt,
        timezone: input.timezone,
        description: input.description,
        location: input.location,
        attendees: input.guestEmail
          ? [{ email: input.guestEmail, responseStatus: 'needsAction' }]
          : undefined,
        sendUpdates,
      },
    });
    return toResult(
      result.ok,
      (result.data ?? null) as Record<string, unknown> | null,
      result.error,
      sendUpdates !== 'none',
    );
  }

  async deleteEvent(input: {
    workspaceId: string;
    workerId: string;
    bookingId: string;
    providerEventId: string;
    sendUpdates?: 'all' | 'externalOnly' | 'none';
    idempotencyKey: string;
  }): Promise<CalendarAdapterResult> {
    const sendUpdates = input.sendUpdates ?? 'all';
    const result = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: 'google-calendar',
      action: 'delete',
      input: { eventId: input.providerEventId, sendUpdates },
    });
    if (!result.ok) {
      return toResult(false, null, result.error, sendUpdates !== 'none');
    }
    return {
      ok: true,
      status: 'succeeded',
      provider: 'google',
      providerEventId: input.providerEventId,
      attendees: [],
      invitationSendRequested: sendUpdates !== 'none',
    };
  }

  async getEvent(input: {
    workspaceId: string;
    workerId: string;
    providerEventId: string;
  }): Promise<CalendarAdapterResult> {
    const result = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: 'google-calendar',
      action: 'get',
      input: { eventId: input.providerEventId },
    });
    return toResult(
      result.ok,
      (result.data ?? null) as Record<string, unknown> | null,
      result.error,
      false,
    );
  }
}

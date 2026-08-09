/**
 * Provider-neutral calendar adapter types (Prompt 704).
 */

import type {
  VcalAttendeeResponseStatus,
  VcalDeliveryState,
} from '../types.js';

export type CalendarProviderId = 'google' | 'microsoft' | 'none';

export type CalendarSendUpdates = 'all' | 'externalOnly' | 'none';

export type CalendarEventInput = {
  workspaceId: string;
  workerId: string;
  bookingId: string;
  summary: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  location?: string;
  guestEmail?: string;
  guestName?: string;
  conferenceData?: Record<string, unknown>;
  sendUpdates?: CalendarSendUpdates;
  idempotencyKey: string;
};

export type CalendarAttendeeSnapshot = {
  email: string;
  responseStatus: VcalAttendeeResponseStatus;
  deliveryState: VcalDeliveryState;
};

export type CalendarAdapterResult = {
  ok: boolean;
  status: 'succeeded' | 'failed' | 'retryable' | 'action_required' | 'not_configured' | 'duplicate';
  provider: CalendarProviderId;
  providerEventId?: string | null;
  etag?: string | null;
  htmlLink?: string | null;
  organizerEmail?: string | null;
  attendees: CalendarAttendeeSnapshot[];
  invitationSendRequested: boolean;
  joinUrl?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  raw?: Record<string, unknown>;
};

export interface CalendarAdapter {
  readonly provider: CalendarProviderId;
  createEvent(input: CalendarEventInput): Promise<CalendarAdapterResult>;
  updateEvent(input: CalendarEventInput & { providerEventId: string }): Promise<CalendarAdapterResult>;
  deleteEvent(input: {
    workspaceId: string;
    workerId: string;
    bookingId: string;
    providerEventId: string;
    sendUpdates?: CalendarSendUpdates;
    idempotencyKey: string;
  }): Promise<CalendarAdapterResult>;
  getEvent(input: {
    workspaceId: string;
    workerId: string;
    providerEventId: string;
  }): Promise<CalendarAdapterResult>;
}

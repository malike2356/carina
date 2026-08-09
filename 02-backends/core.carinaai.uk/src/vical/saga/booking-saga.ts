/**
 * Canonical provider-neutral booking saga (Prompt 703).
 * All public / outreach / API / agent entry points should call through here
 * for Zoom/calendar provisioning instead of soft-failing into confirmed.
 */

import crypto from 'crypto';
import { retryAsync } from '../../infrastructure/retry.js';
import {
  cancelBookingForHost,
  createBooking,
  getBooking,
  getEventType,
  rescheduleBooking,
} from '../bookings.js';
import {
  deleteBookingGoogleCalendar,
  syncBookingToGoogleCalendar,
  updateBookingGoogleCalendar,
} from '../calendar-sync.js';
import { StaticUrlConferencingAdapter } from '../conferencing/static-url-adapter.js';
import { toPublicBookingView } from '../conferencing/redact.js';
import type { ConferencingAdapter } from '../conferencing/types.js';
import { ZoomConferencingAdapter } from '../conferencing/zoom-adapter.js';
import { mutateVicalStore } from '../store.js';
import type { VcalBooking, VcalBookingSource, VcalBusyWindow, VcalLocationMode } from '../types.js';
import {
  addBookingParticipants,
  commitBookingIntent,
  createAvailabilityHold,
  findBookingByIdempotencyKey,
  getConferenceArtifact,
  listProviderOperationsForBooking,
  recordProviderOperation,
  releaseAvailabilityHold,
  upsertBookingIntent,
  upsertConferenceArtifact,
} from './ledger.js';

export type SagaDeps = {
  zoomAdapter?: ConferencingAdapter;
  staticAdapter?: ConferencingAdapter;
  syncCalendar?: typeof syncBookingToGoogleCalendar;
  updateCalendar?: typeof updateBookingGoogleCalendar;
  deleteCalendar?: typeof deleteBookingGoogleCalendar;
  sleep?: (ms: number) => Promise<void>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function patchBooking(
  workspaceId: string,
  bookingId: string,
  patch: Partial<VcalBooking>,
): VcalBooking {
  let next: VcalBooking | null = null;
  mutateVicalStore((store) => {
    const idx = store.bookings.findIndex((b) => b.workspaceId === workspaceId && b.id === bookingId);
    if (idx < 0) return;
    next = {
      ...store.bookings[idx]!,
      ...patch,
      metadata: {
        ...store.bookings[idx]!.metadata,
        ...(patch.metadata ?? {}),
      },
      updatedAt: nowIso(),
    };
    store.bookings[idx] = next;
  });
  return next ?? (getBooking(workspaceId, bookingId) as VcalBooking);
}

function resolveAdapters(deps: SagaDeps): {
  zoom: ConferencingAdapter;
  staticUrl: ConferencingAdapter;
} {
  return {
    zoom: deps.zoomAdapter ?? new ZoomConferencingAdapter(),
    staticUrl: deps.staticAdapter ?? new StaticUrlConferencingAdapter(),
  };
}

export type BookWithSagaInput = {
  workspaceId: string;
  workerId: string;
  eventTypeId: string;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  source?: VcalBookingSource;
  leadId?: string;
  contactId?: string;
  notes?: string;
  meetingUrl?: string;
  /** Prefer client/tool-supplied key; otherwise derived stably from inputs. */
  idempotencyKey?: string;
  staticRoomUrl?: string;
  preferManagedZoom?: boolean;
  externalBusy?: VcalBusyWindow[];
  metadata?: Record<string, unknown>;
  hostEmail?: string;
};

export type SagaResult = {
  booking: VcalBooking;
  publicBooking: Record<string, unknown>;
  duplicate: boolean;
  conferenceManaged: boolean;
  providerOperations: ReturnType<typeof listProviderOperationsForBooking>;
  actionRequired: boolean;
};

function defaultIdempotencyKey(input: BookWithSagaInput): string {
  if (input.idempotencyKey?.trim()) return input.idempotencyKey.trim();
  const material = [
    input.workspaceId,
    input.eventTypeId,
    input.guestEmail.trim().toLowerCase(),
    new Date(input.startsAt).toISOString(),
  ].join('|');
  return `vical:${crypto.createHash('sha256').update(material).digest('hex').slice(0, 32)}`;
}

async function provisionConference(input: {
  booking: VcalBooking;
  workerId: string;
  locationMode: VcalLocationMode;
  staticRoomUrl?: string;
  preferManagedZoom?: boolean;
  idempotencyKey: string;
  deps: SagaDeps;
}): Promise<{ joinUrl?: string; managed: boolean; ok: boolean; reason?: string }> {
  const { zoom, staticUrl } = resolveAdapters(input.deps);
  const durationMinutes = Math.max(
    15,
    Math.round((Date.parse(input.booking.endsAt) - Date.parse(input.booking.startsAt)) / 60_000),
  );
  const confKey = `zoom:create:${input.idempotencyKey}`;

  if (input.locationMode !== 'zoom') {
    return { managed: false, ok: true };
  }

  const tryZoom = input.preferManagedZoom !== false;
  if (tryZoom) {
    recordProviderOperation({
      workspaceId: input.booking.workspaceId,
      bookingId: input.booking.id,
      provider: 'zoom',
      action: 'create_meeting',
      idempotencyKey: confKey,
      status: 'pending',
    });

    const result = await retryAsync(
      async () => {
        const r = await zoom.createMeeting({
          workspaceId: input.booking.workspaceId,
          workerId: input.workerId,
          bookingId: input.booking.id,
          topic: `Meeting with ${input.booking.guestName}`,
          startsAt: input.booking.startsAt,
          durationMinutes,
          timezone: input.booking.timezone,
          guestEmail: input.booking.guestEmail,
          idempotencyKey: confKey,
          staticRoomUrl: input.staticRoomUrl,
        });
        if (!r.ok && r.status === 'retryable') {
          const err = new Error(r.errorMessage ?? 'zoom_retryable') as Error & {
            retryAfterMs?: number;
          };
          err.retryAfterMs = r.retryAfterMs;
          throw err;
        }
        return r;
      },
      {
        attempts: 3,
        minDelayMs: 50,
        maxDelayMs: 500,
        sleep: input.deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
        retryAfterMs: (err) => (err as { retryAfterMs?: number }).retryAfterMs,
        shouldRetry: (err) => Boolean((err as Error).message),
      },
    ).catch(async () =>
      zoom.createMeeting({
        workspaceId: input.booking.workspaceId,
        workerId: input.workerId,
        bookingId: input.booking.id,
        topic: `Meeting with ${input.booking.guestName}`,
        startsAt: input.booking.startsAt,
        durationMinutes,
        timezone: input.booking.timezone,
        guestEmail: input.booking.guestEmail,
        idempotencyKey: confKey,
        staticRoomUrl: input.staticRoomUrl,
      }),
    );

    recordProviderOperation({
      workspaceId: input.booking.workspaceId,
      bookingId: input.booking.id,
      provider: 'zoom',
      action: 'create_meeting',
      idempotencyKey: confKey,
      status:
        result.status === 'duplicate'
          ? 'duplicate'
          : result.ok
            ? 'succeeded'
            : result.status === 'retryable'
              ? 'retryable'
              : result.status === 'action_required' || result.status === 'not_configured'
                ? 'action_required'
                : 'failed',
      providerResourceId: result.artifact.providerMeetingId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });

    if (result.ok && result.artifact.joinUrl) {
      const artifact = upsertConferenceArtifact({
        id: crypto.randomUUID(),
        workspaceId: input.booking.workspaceId,
        bookingId: input.booking.id,
        provider: 'zoom',
        providerMeetingId: result.artifact.providerMeetingId,
        joinUrl: result.artifact.joinUrl,
        // Intentionally omit hostStartUrl from durable public store fields.
        hostStartUrlEnc: null,
        hostStartUrlPresent: result.artifact.hostStartUrlPresent,
        passcodeRequired: result.artifact.passcodeRequired,
        waitingRoom: result.artifact.waitingRoom,
        managed: true,
      });
      patchBooking(input.booking.workspaceId, input.booking.id, {
        meetingUrl: result.artifact.joinUrl,
        conferenceArtifactId: artifact.id,
        metadata: {
          zoomMeetingId: result.artifact.providerMeetingId,
          zoomWaitingRoom: result.artifact.waitingRoom,
          zoomPasscodeRequired: result.artifact.passcodeRequired,
        },
      });
      return { joinUrl: result.artifact.joinUrl, managed: true, ok: true };
    }

    // Fall through to labelled static URL only when Zoom is not configured.
    if (result.status !== 'not_configured' && !input.staticRoomUrl) {
      return {
        managed: true,
        ok: false,
        reason: result.errorMessage ?? result.errorCode ?? 'zoom_create_failed',
      };
    }
  }

  const fallback = await staticUrl.createMeeting({
    workspaceId: input.booking.workspaceId,
    workerId: input.workerId,
    bookingId: input.booking.id,
    topic: `Meeting with ${input.booking.guestName}`,
    startsAt: input.booking.startsAt,
    durationMinutes,
    timezone: input.booking.timezone,
    guestEmail: input.booking.guestEmail,
    idempotencyKey: `static:${input.idempotencyKey}`,
    staticRoomUrl: input.staticRoomUrl ?? input.booking.meetingUrl,
  });
  recordProviderOperation({
    workspaceId: input.booking.workspaceId,
    bookingId: input.booking.id,
    provider: 'static_url',
    action: 'create_meeting',
    idempotencyKey: `static:${input.idempotencyKey}`,
    status: fallback.ok ? 'succeeded' : 'action_required',
    providerResourceId: fallback.artifact.providerMeetingId,
    errorCode: fallback.errorCode,
    errorMessage: fallback.errorMessage,
  });
  if (fallback.ok && fallback.artifact.joinUrl) {
    const artifact = upsertConferenceArtifact({
      id: crypto.randomUUID(),
      workspaceId: input.booking.workspaceId,
      bookingId: input.booking.id,
      provider: 'static_url',
      providerMeetingId: fallback.artifact.providerMeetingId,
      joinUrl: fallback.artifact.joinUrl,
      hostStartUrlPresent: false,
      passcodeRequired: false,
      waitingRoom: false,
      managed: false,
      fallbackLabel: 'static_room_url_fallback',
    });
    patchBooking(input.booking.workspaceId, input.booking.id, {
      meetingUrl: fallback.artifact.joinUrl,
      conferenceArtifactId: artifact.id,
      metadata: {
        conferenceFallback: 'static_room_url_fallback',
        conferenceManaged: false,
      },
    });
    return { joinUrl: fallback.artifact.joinUrl, managed: false, ok: true };
  }
  return {
    managed: false,
    ok: false,
    reason: fallback.errorMessage ?? 'no_join_method',
  };
}

export async function bookWithSaga(
  input: BookWithSagaInput,
  deps: SagaDeps = {},
): Promise<SagaResult> {
  const idempotencyKey = defaultIdempotencyKey(input);
  const existingId = findBookingByIdempotencyKey(input.workspaceId, idempotencyKey);
  if (existingId) {
    const booking = getBooking(input.workspaceId, existingId.bookingId)!;
    return {
      booking,
      publicBooking: toPublicBookingView(booking as unknown as Record<string, unknown>),
      duplicate: true,
      conferenceManaged: getConferenceArtifact(input.workspaceId, booking.id)?.managed ?? false,
      providerOperations: listProviderOperationsForBooking(input.workspaceId, booking.id),
      actionRequired: booking.orchestrationStatus === 'action_required',
    };
  }

  const eventType = getEventType(input.workspaceId, input.eventTypeId);
  if (!eventType) throw new Error('Event type not found');

  const startsAt = new Date(input.startsAt).toISOString();
  const endsAt = input.endsAt
    ? new Date(input.endsAt).toISOString()
    : new Date(Date.parse(startsAt) + eventType.durationMinutes * 60_000).toISOString();

  const hold = createAvailabilityHold({
    workspaceId: input.workspaceId,
    hostUserId: eventType.hostUserId,
    eventTypeId: eventType.id,
    startsAt,
    endsAt,
  });
  const intent = upsertBookingIntent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    eventTypeId: eventType.id,
    idempotencyKey,
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    startsAt,
    endsAt,
    timezone: input.timezone ?? 'Europe/London',
    holdId: hold.id,
    metadata: input.metadata,
  });

  let booking = createBooking({
    workspaceId: input.workspaceId,
    eventTypeId: eventType.id,
    guestName: input.guestName,
    guestEmail: input.guestEmail,
    startsAt,
    endsAt,
    timezone: input.timezone,
    source: input.source ?? 'api',
    leadId: input.leadId,
    contactId: input.contactId,
    notes: input.notes,
    meetingUrl: input.meetingUrl,
    externalBusy: input.externalBusy,
    metadata: { ...(input.metadata ?? {}), saga: true },
    idempotencyKey,
  });

  // createBooking may not yet accept idempotencyKey; patch immediately.
  booking = patchBooking(input.workspaceId, booking.id, {
    idempotencyKey,
    orchestrationStatus: 'provisioning',
    status: booking.status === 'confirmed' ? 'confirmed' : booking.status,
  });

  commitBookingIntent(intent.id, booking.id);
  addBookingParticipants({
    workspaceId: input.workspaceId,
    bookingId: booking.id,
    hostEmail: input.hostEmail,
    guestEmail: input.guestEmail,
    guestName: input.guestName,
  });
  releaseAvailabilityHold(hold.id);

  const conf = await provisionConference({
    booking,
    workerId: input.workerId,
    locationMode: eventType.locationMode,
    staticRoomUrl: input.staticRoomUrl,
    preferManagedZoom: input.preferManagedZoom,
    idempotencyKey,
    deps,
  });
  booking = getBooking(input.workspaceId, booking.id)!;

  const syncCalendar = deps.syncCalendar ?? syncBookingToGoogleCalendar;
  let calendarOk = true;
  let calendarReason: string | undefined;
  if (eventType.locationMode !== 'none' && eventType.locationMode !== 'phone' && eventType.locationMode !== 'in_person') {
    const calKey = `gcal:create:${idempotencyKey}`;
    recordProviderOperation({
      workspaceId: input.workspaceId,
      bookingId: booking.id,
      provider: 'google_calendar',
      action: 'create_event',
      idempotencyKey: calKey,
      status: 'pending',
    });
    const sync = await syncCalendar({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      bookingId: booking.id,
      locationMode: eventType.locationMode,
      zoomRoomUrl: conf.joinUrl ?? input.staticRoomUrl,
    });
    calendarOk = sync.ok || Boolean(sync.skipped);
    calendarReason = sync.warning;
    recordProviderOperation({
      workspaceId: input.workspaceId,
      bookingId: booking.id,
      provider: 'google_calendar',
      action: 'create_event',
      idempotencyKey: calKey,
      status: sync.skipped ? 'succeeded' : sync.ok ? 'succeeded' : 'action_required',
      providerResourceId: sync.booking.calendarEventId,
      errorMessage: sync.warning,
    });
    booking = getBooking(input.workspaceId, booking.id)!;
  }

  const needsJoin = eventType.locationMode === 'zoom' || eventType.locationMode === 'google_meet';
  const hasJoin = Boolean(booking.meetingUrl || conf.joinUrl);
  const actionRequired = (needsJoin && !conf.ok) || (needsJoin && !hasJoin) || !calendarOk;

  if (actionRequired) {
    booking = patchBooking(input.workspaceId, booking.id, {
      orchestrationStatus: 'action_required',
      actionRequiredReason:
        (!conf.ok ? conf.reason : undefined)
        || (!calendarOk ? calendarReason : undefined)
        || 'provider_step_failed',
    });
  } else {
    booking = patchBooking(input.workspaceId, booking.id, {
      orchestrationStatus: 'confirmed',
      actionRequiredReason: undefined,
    });
  }

  return {
    booking,
    publicBooking: toPublicBookingView(booking as unknown as Record<string, unknown>),
    duplicate: false,
    conferenceManaged: conf.managed,
    providerOperations: listProviderOperationsForBooking(input.workspaceId, booking.id),
    actionRequired,
  };
}

export async function rescheduleWithSaga(
  input: {
    workspaceId: string;
    workerId: string;
    bookingId: string;
    startsAt: string;
    endsAt?: string;
    externalBusy?: VcalBusyWindow[];
  },
  deps: SagaDeps = {},
): Promise<SagaResult> {
  const before = getBooking(input.workspaceId, input.bookingId);
  if (!before) throw new Error('Booking not found');
  const idempotencyKey =
    before.idempotencyKey
    ?? `reschedule:${before.id}:${new Date(input.startsAt).toISOString()}`;

  patchBooking(input.workspaceId, before.id, { orchestrationStatus: 'rescheduling' });
  let booking = rescheduleBooking({
    workspaceId: input.workspaceId,
    bookingId: input.bookingId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    externalBusy: input.externalBusy,
  });

  const artifact = getConferenceArtifact(input.workspaceId, booking.id);
  const { zoom } = resolveAdapters(deps);

  if (artifact?.provider === 'zoom' && artifact.providerMeetingId) {
    const updateKey = `zoom:update:${idempotencyKey}:${booking.startsAt}`;
    const durationMinutes = Math.max(
      15,
      Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60_000),
    );
    const result = await zoom.updateMeeting({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      bookingId: booking.id,
      providerMeetingId: artifact.providerMeetingId,
      topic: `Meeting with ${booking.guestName}`,
      startsAt: booking.startsAt,
      durationMinutes,
      timezone: booking.timezone,
      guestEmail: booking.guestEmail,
      idempotencyKey: updateKey,
    });
    recordProviderOperation({
      workspaceId: input.workspaceId,
      bookingId: booking.id,
      provider: 'zoom',
      action: 'update_meeting',
      idempotencyKey: updateKey,
      status: result.ok ? 'succeeded' : 'action_required',
      providerResourceId: artifact.providerMeetingId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
    if (result.ok && result.artifact.joinUrl) {
      upsertConferenceArtifact({
        ...artifact,
        joinUrl: result.artifact.joinUrl,
        hostStartUrlPresent: result.artifact.hostStartUrlPresent,
      });
      booking = patchBooking(input.workspaceId, booking.id, { meetingUrl: result.artifact.joinUrl });
    } else if (!result.ok) {
      booking = patchBooking(input.workspaceId, booking.id, {
        orchestrationStatus: 'action_required',
        actionRequiredReason: result.errorMessage ?? 'zoom_update_failed',
      });
    }
  }

  const updateCalendar = deps.updateCalendar ?? updateBookingGoogleCalendar;
  if (booking.calendarEventId) {
    const sync = await updateCalendar({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      bookingId: booking.id,
    });
    if (!sync.ok && !sync.skipped) {
      booking = patchBooking(input.workspaceId, booking.id, {
        orchestrationStatus: 'action_required',
        actionRequiredReason: sync.warning ?? 'calendar_update_failed',
      });
    }
  }

  if (booking.orchestrationStatus !== 'action_required') {
    booking = patchBooking(input.workspaceId, booking.id, { orchestrationStatus: 'confirmed' });
  }

  return {
    booking,
    publicBooking: toPublicBookingView(booking as unknown as Record<string, unknown>),
    duplicate: false,
    conferenceManaged: artifact?.managed ?? false,
    providerOperations: listProviderOperationsForBooking(input.workspaceId, booking.id),
    actionRequired: booking.orchestrationStatus === 'action_required',
  };
}

export async function cancelWithSaga(
  input: {
    workspaceId: string;
    workerId: string;
    bookingId: string;
    reason?: string;
  },
  deps: SagaDeps = {},
): Promise<SagaResult> {
  const before = getBooking(input.workspaceId, input.bookingId);
  if (!before) throw new Error('Booking not found');
  const artifact = getConferenceArtifact(input.workspaceId, before.id);
  const { zoom } = resolveAdapters(deps);
  let zoomDeleteFailed = false;

  if (artifact?.provider === 'zoom' && artifact.providerMeetingId) {
    const delKey = `zoom:delete:${before.idempotencyKey ?? before.id}`;
    const result = await zoom.deleteMeeting({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      bookingId: before.id,
      providerMeetingId: artifact.providerMeetingId,
      idempotencyKey: delKey,
    });
    recordProviderOperation({
      workspaceId: input.workspaceId,
      bookingId: before.id,
      provider: 'zoom',
      action: 'cancel_meeting',
      idempotencyKey: delKey,
      status: result.ok ? 'succeeded' : result.status === 'retryable' ? 'retryable' : 'action_required',
      providerResourceId: artifact.providerMeetingId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
    if (!result.ok) {
      zoomDeleteFailed = true;
      patchBooking(input.workspaceId, before.id, {
        orchestrationStatus: 'action_required',
        actionRequiredReason: result.errorMessage ?? 'zoom_delete_failed',
      });
    }
  }

  const deleteCalendar = deps.deleteCalendar ?? deleteBookingGoogleCalendar;
  if (before.calendarEventId) {
    await deleteCalendar({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      bookingId: before.id,
    }).catch(() => undefined);
  }

  const booking = cancelBookingForHost(input.workspaceId, input.bookingId, input.reason);
  const next = patchBooking(input.workspaceId, booking.id, {
    orchestrationStatus: zoomDeleteFailed ? 'action_required' : 'cancelled',
    actionRequiredReason: zoomDeleteFailed
      ? booking.actionRequiredReason ?? 'zoom_delete_failed'
      : undefined,
  });

  return {
    booking: next,
    publicBooking: toPublicBookingView(next as unknown as Record<string, unknown>),
    duplicate: false,
    conferenceManaged: artifact?.managed ?? false,
    providerOperations: listProviderOperationsForBooking(input.workspaceId, next.id),
    actionRequired: next.orchestrationStatus === 'action_required',
  };
}

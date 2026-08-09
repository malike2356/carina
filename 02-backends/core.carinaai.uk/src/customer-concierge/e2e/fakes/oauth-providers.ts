/**
 * Shared fake OAuth / provider doubles for Customer Concierge hermetic e2e (Prompt 706).
 * No live network. Tokens never look like production secrets.
 */
import type { ConferenceAdapterResult, ConferencingAdapter } from '../../../vical/conferencing/types.js';

export type FakeOAuthTokenState = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  revoked: boolean;
};

export function createFakeOAuthState(provider: 'zoom' | 'google' | 'microsoft'): FakeOAuthTokenState {
  return {
    accessToken: `fake_${provider}_access_synth`,
    refreshToken: `fake_${provider}_refresh_synth`,
    expiresAt: Date.now() + 3_600_000,
    revoked: false,
  };
}

export function revokeFakeOAuth(state: FakeOAuthTokenState): void {
  state.revoked = true;
  state.expiresAt = 0;
}

export function fakeZoomAdapter(opts?: {
  mode?: 'ok' | 'expired' | 'rate' | 'revoked';
}): ConferencingAdapter & { creates: number } {
  const mode = opts?.mode ?? 'ok';
  const cache = new Map<string, ConferenceAdapterResult>();
  return {
    provider: 'zoom',
    creates: 0,
    async createMeeting(input) {
      this.creates += 1;
      const existing = cache.get(input.idempotencyKey);
      if (existing) return { ...existing, duplicate: true, status: 'duplicate' };
      if (mode === 'expired' || mode === 'revoked') {
        return {
          ok: false,
          status: 'action_required',
          artifact: {
            provider: 'zoom',
            providerMeetingId: null,
            joinUrl: null,
            hostStartUrlPresent: false,
            passcodeRequired: false,
            waitingRoom: true,
            managed: true,
          },
          errorCode: mode === 'revoked' ? 'revoked_token' : 'expired_token',
          errorMessage: mode === 'revoked' ? 'Zoom token revoked' : 'Zoom access token expired',
        };
      }
      if (mode === 'rate') {
        return {
          ok: false,
          status: 'retryable',
          artifact: {
            provider: 'zoom',
            providerMeetingId: null,
            joinUrl: null,
            hostStartUrlPresent: false,
            passcodeRequired: false,
            waitingRoom: true,
            managed: true,
          },
          errorCode: 'rate_limited',
          errorMessage: 'Zoom rate limited',
          retryAfterMs: 10,
        };
      }
      const result: ConferenceAdapterResult = {
        ok: true,
        status: 'succeeded',
        artifact: {
          provider: 'zoom',
          providerMeetingId: `zm_synth_${this.creates}`,
          joinUrl: `https://zoom.us/j/synth${this.creates}`,
          hostStartUrlPresent: true,
          passcodeRequired: false,
          waitingRoom: true,
          managed: true,
        },
      };
      cache.set(input.idempotencyKey, result);
      return result;
    },
    async updateMeeting() {
      return {
        ok: true,
        status: 'succeeded',
        artifact: {
          provider: 'zoom',
          providerMeetingId: 'zm_synth_upd',
          joinUrl: 'https://zoom.us/j/synth-upd',
          hostStartUrlPresent: true,
          passcodeRequired: false,
          waitingRoom: true,
          managed: true,
        },
      };
    },
    async deleteMeeting() {
      return {
        ok: true,
        status: 'succeeded',
        artifact: {
          provider: 'zoom',
          providerMeetingId: null,
          joinUrl: null,
          hostStartUrlPresent: false,
          passcodeRequired: false,
          waitingRoom: true,
          managed: true,
        },
      };
    },
  };
}

export function fakeGoogleCalendarSync(opts?: { fail?: boolean }) {
  return async (input: {
    workspaceId: string;
    workerId: string;
    bookingId: string;
    locationMode?: string;
    zoomRoomUrl?: string;
  }) => {
    const { getBooking } = await import('../../../vical/bookings.js');
    const { mutateVicalStore } = await import('../../../vical/store.js');
    const booking = getBooking(input.workspaceId, input.bookingId);
    if (!booking) {
      return { ok: false, skipped: false, warning: 'booking_missing', booking: null as never, invitationSendRequested: false };
    }
    let next = booking;
    mutateVicalStore((store) => {
      const idx = store.bookings.findIndex((b) => b.id === booking.id);
      if (idx < 0) return;
      if (opts?.fail) {
        next = {
          ...store.bookings[idx]!,
          calendarSyncStatus: 'failed',
          calendarSyncError: 'fake_google_fail',
          invitationDeliveryState: 'failed',
          orchestrationStatus: 'action_required',
          actionRequiredReason: 'calendar_invitation_failed',
          updatedAt: new Date().toISOString(),
        };
      } else {
        next = {
          ...store.bookings[idx]!,
          calendarEventId: `gcal_synth_${booking.id.slice(0, 8)}`,
          calendarSyncStatus: 'synced',
          calendarProvider: 'google',
          invitationDeliveryState: 'sent',
          meetingUrl: booking.meetingUrl ?? input.zoomRoomUrl,
          updatedAt: new Date().toISOString(),
        };
      }
      store.bookings[idx] = next;
    });
    if (opts?.fail) {
      return {
        ok: false,
        skipped: false,
        warning: 'fake_google_fail',
        booking: next,
        invitationSendRequested: true,
        deliveryState: 'failed' as const,
      };
    }
    return {
      ok: true,
      skipped: false,
      booking: next,
      invitationSendRequested: true,
      deliveryState: 'sent' as const,
    };
  };
}

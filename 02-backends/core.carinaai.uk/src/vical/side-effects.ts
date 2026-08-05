/**
 * Side effects for viCal lifecycle: reminders + outbound webhooks.
 * Calendar sync stays explicit (needs worker OAuth context).
 */
import { dispatchWebhook } from '../webhooks/dispatcher.js';
import type { WebhookEvent } from '../webhooks/webhook-types.js';
import { onVcalHook } from './hooks.js';
import { cancelVicalRemindersForBooking, scheduleVicalReminders } from './reminders.js';
import type { VcalDomainHook } from './types.js';

let registered = false;

function hookToWebhookEvent(hook: VcalDomainHook): WebhookEvent | null {
  switch (hook.type) {
    case 'booking.created':
      return 'vical.booking.created';
    case 'booking.confirmed':
      return 'vical.booking.confirmed';
    case 'booking.cancelled':
    case 'booking.rejected':
      return 'vical.booking.cancelled';
    case 'booking.rescheduled':
      return 'vical.booking.rescheduled';
    case 'booking.outcome':
      return 'vical.booking.outcome';
    default:
      return null;
  }
}

function bookingPayload(hook: VcalDomainHook): Record<string, unknown> {
  const booking = hook.booking;
  return {
    bookingId: booking.id,
    workspaceId: booking.workspaceId,
    status: booking.status,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    guestEmail: booking.guestEmail,
    guestName: booking.guestName,
    meetingUrl: booking.meetingUrl,
    source: booking.source,
    sessionOutcome: booking.sessionOutcome,
    previousStartsAt: 'previousStartsAt' in hook ? hook.previousStartsAt : undefined,
    previousEndsAt: 'previousEndsAt' in hook ? hook.previousEndsAt : undefined,
  };
}

export function registerVicalSideEffects(): void {
  if (registered) return;
  registered = true;
  onVcalHook((hook) => {
    if (hook.type === 'booking.confirmed') {
      scheduleVicalReminders({
        workspaceId: hook.booking.workspaceId,
        bookingId: hook.booking.id,
      });
    }
    if (hook.type === 'booking.rescheduled') {
      scheduleVicalReminders({
        workspaceId: hook.booking.workspaceId,
        bookingId: hook.booking.id,
      });
    }
    if (hook.type === 'booking.cancelled' || hook.type === 'booking.rejected') {
      cancelVicalRemindersForBooking(hook.booking.workspaceId, hook.booking.id, hook.type);
    }

    const event = hookToWebhookEvent(hook);
    if (!event) return;
    void dispatchWebhook(event, bookingPayload(hook)).catch(() => undefined);
  });
}

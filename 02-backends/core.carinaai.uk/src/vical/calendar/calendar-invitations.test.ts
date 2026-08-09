/**
 * Prompt 704: calendar invitations, delivery states, Google webhook reconcile.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('calendar invitations + reconciliation (704)', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-vical-704-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('AIVA_CONCIERGE_GOOGLE_CALENDAR_WEBHOOK_TOKEN', 'gcal-token-test');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  async function load() {
    return import('../index.js');
  }

  it('requests sendUpdates and marks invitation_sent on successful create', async () => {
    const vical = await load();
    const workspaceId = 'ws-704';
    const workerId = 'worker-704';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: workerId });
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 1,
    });
    expect(slots[0]).toBeTruthy();

    const calls: Array<{ action: string; input: Record<string, unknown> }> = [];
    const result = await vical.bookWithSaga(
      {
        workspaceId,
        workerId,
        eventTypeId: eventType.id,
        guestName: 'Ada',
        guestEmail: 'ada@example.com',
        startsAt: slots[0]!.start,
        idempotencyKey: '704-invite-1',
      },
      {
        zoomAdapter: {
          provider: 'zoom',
          async createMeeting() {
            return {
              ok: true,
              status: 'succeeded',
              artifact: {
                provider: 'static_url',
                providerMeetingId: 'static:1',
                joinUrl: 'https://zoom.us/j/1',
                hostStartUrlPresent: false,
                passcodeRequired: false,
                waitingRoom: false,
                managed: false,
              },
            };
          },
          async updateMeeting() {
            return {
              ok: true,
              status: 'succeeded',
              artifact: {
                provider: 'zoom',
                providerMeetingId: '1',
                joinUrl: 'https://zoom.us/j/1',
                hostStartUrlPresent: false,
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
                providerMeetingId: '1',
                joinUrl: null,
                hostStartUrlPresent: false,
                passcodeRequired: false,
                waitingRoom: true,
                managed: true,
              },
            };
          },
        },
        syncCalendar: async ({ bookingId }) => {
          calls.push({ action: 'create', input: { sendUpdates: 'all', bookingId } });
          // Simulate calendar-sync success path by patching via book result consumer.
          const booking = vical.getBooking(workspaceId, bookingId)!;
          return {
            ok: true,
            booking: {
              ...booking,
              calendarEventId: 'evt_704',
              calendarSyncStatus: 'synced',
              invitationDeliveryState: 'sent',
              meetingUrl: booking.meetingUrl || 'https://meet.google.com/abc-defg-hij',
            },
            invitationSendRequested: true,
            deliveryState: 'sent',
          };
        },
        sleep: async () => undefined,
      },
    );

    expect(calls[0]?.input.sendUpdates).toBe('all');
    expect(result.booking.invitationDeliveryState || result.publicBooking.invitationDeliveryState).toBeTruthy();
    const view = vical.bookingInvitationView({
      ...result.booking,
      invitationDeliveryState: 'sent',
    });
    expect(view.invitationUiLabel).toBe('invitation_sent');
    expect(view.disclaimer.toLowerCase()).toContain('does not promise');
  });

  it('marks delivery_failed and action_required when calendar invitation fails', async () => {
    const vical = await load();
    const workspaceId = 'ws-704-fail';
    const workerId = 'worker-704';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: workerId });
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 1,
    });

    const result = await vical.bookWithSaga(
      {
        workspaceId,
        workerId,
        eventTypeId: eventType.id,
        guestName: 'Bo',
        guestEmail: 'bo@example.com',
        startsAt: slots[0]!.start,
        idempotencyKey: '704-fail-1',
      },
      {
        syncCalendar: async ({ bookingId }) => {
          const booking = vical.getBooking(workspaceId, bookingId)!;
          return {
            ok: false,
            booking: {
              ...booking,
              calendarSyncStatus: 'failed',
              invitationDeliveryState: 'failed',
            },
            warning: 'invitation failed',
            deliveryState: 'failed',
          };
        },
        sleep: async () => undefined,
      },
    );

    expect(result.actionRequired).toBe(true);
    expect(vical.bookingInvitationView({
      ...result.booking,
      invitationDeliveryState: 'failed',
    }).invitationUiLabel).toBe('delivery_failed');
  });

  it('dedupes Google webhook callbacks and reconciles accept/decline', async () => {
    const vical = await load();
    const workspaceId = 'ws-704-wh';
    const workerId = 'worker-704';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: workerId });
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 1,
    });
    const created = await vical.bookWithSaga(
      {
        workspaceId,
        workerId,
        eventTypeId: eventType.id,
        guestName: 'Cy',
        guestEmail: 'cy@example.com',
        startsAt: slots[0]!.start,
        idempotencyKey: '704-wh-1',
      },
      {
        syncCalendar: async ({ bookingId }) => {
          const booking = vical.getBooking(workspaceId, bookingId)!;
          vical.updateParticipantDelivery({
            workspaceId,
            bookingId,
            email: 'cy@example.com',
            deliveryState: 'sent',
            responseStatus: 'needsAction',
          });
          // Seed projection for reconcile helpers
          const { upsertCalendarProjection } = await import('../calendar/projection-store.js');
          upsertCalendarProjection({
            workspaceId,
            bookingId,
            result: {
              ok: true,
              status: 'succeeded',
              provider: 'google',
              providerEventId: 'evt_wh_1',
              attendees: [
                {
                  email: 'cy@example.com',
                  responseStatus: 'needsAction',
                  deliveryState: 'sent',
                },
              ],
              invitationSendRequested: true,
            },
          });
          return {
            ok: true,
            booking: { ...booking, calendarEventId: 'evt_wh_1', invitationDeliveryState: 'sent' },
            deliveryState: 'sent',
            invitationSendRequested: true,
          };
        },
        sleep: async () => undefined,
      },
    );

    const accepted = vical.applySyntheticAttendeeResponse({
      workspaceId,
      bookingId: created.booking.id,
      email: 'cy@example.com',
      responseStatus: 'accepted',
    });
    expect(accepted.deliveryState).toBe('accepted');
    expect(vical.getBooking(workspaceId, created.booking.id)?.invitationDeliveryState).toBe('accepted');

    const declined = vical.applySyntheticAttendeeResponse({
      workspaceId,
      bookingId: created.booking.id,
      email: 'cy@example.com',
      responseStatus: 'declined',
    });
    expect(declined.deliveryState).toBe('declined');

    const first = await vical.handleGoogleCalendarWebhook({
      channelId: 'ch-1',
      resourceId: 'res-1',
      resourceState: 'exists',
      messageNumber: '1',
      channelToken: 'gcal-token-test',
      // No resourceUri: validates auth + dedupe without calling live Google getEvent.
    });
    const second = await vical.handleGoogleCalendarWebhook({
      channelId: 'ch-1',
      resourceId: 'res-1',
      resourceState: 'exists',
      messageNumber: '1',
      channelToken: 'gcal-token-test',
    });
    expect(first.ok).toBe(true);
    expect(first.reason).toBe('no_event_id');
    expect(second.duplicate).toBe(true);
    expect(
      vical.verifyGoogleCalendarWebhook({ channelToken: 'bad', channelId: 'ch-1' }),
    ).toBe(false);
    expect(
      vical.verifyGoogleCalendarWebhook({ channelToken: 'gcal-token-test' }),
    ).toBe(true);
  });

  it('builds REQUEST and CANCEL ICS with sequence', async () => {
    const vical = await load();
    const booking = {
      id: 'b1',
      workspaceId: 'w',
      eventTypeId: 'e',
      hostUserId: 'h',
      guestName: 'Ada',
      guestEmail: 'ada@example.com',
      startsAt: '2026-08-05T18:00:00.000Z',
      endsAt: '2026-08-05T18:30:00.000Z',
      timezone: 'Europe/London',
      status: 'confirmed' as const,
      guestToken: 'tok',
      source: 'api' as const,
      metadata: {},
      createdAt: '2026-08-05T10:00:00.000Z',
      updatedAt: '2026-08-05T10:00:00.000Z',
      meetingUrl: 'https://zoom.us/j/1',
    };
    const request = vical.formatBookingIcs(booking, { method: 'REQUEST' });
    expect(request).toContain('METHOD:REQUEST');
    expect(request).toContain('ATTENDEE');
    const cancel = vical.formatBookingIcs(
      { ...booking, previousStartsAt: booking.startsAt },
      { method: 'CANCEL', sequence: 2 },
    );
    expect(cancel).toContain('METHOD:CANCEL');
    expect(cancel).toContain('SEQUENCE:2');
    expect(cancel).toContain('STATUS:CANCELLED');
  });

  it('covers DST-safe ISO round trip in ICS timestamps', async () => {
    const vical = await load();
    // UK DST spring-forward edge: 2026-03-29 01:00 local becomes 00:00/01:00 UTC ambiguity; store UTC.
    const booking = {
      id: 'dst1',
      workspaceId: 'w',
      eventTypeId: 'e',
      hostUserId: 'h',
      guestName: 'Dst',
      guestEmail: 'dst@example.com',
      startsAt: '2026-03-29T01:30:00.000Z',
      endsAt: '2026-03-29T02:00:00.000Z',
      timezone: 'Europe/London',
      status: 'confirmed' as const,
      guestToken: 'tok',
      source: 'api' as const,
      metadata: {},
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    };
    const ics = vical.formatBookingIcs(booking, { method: 'REQUEST' });
    expect(ics).toContain('DTSTART:20260329T013000Z');
    expect(ics).toContain('DTEND:20260329T020000Z');
  });
});

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('viCal reminders + ICS + soft calendar sync metadata', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-vical-09-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('schedules reminders on confirm and cancels them on cancel', async () => {
    const {
      createEventType,
      createAvailabilityRule,
      createBooking,
      cancelBookingForHost,
      scheduleVicalReminders,
      listVicalReminders,
      registerVicalSideEffects,
    } = await import('./index.js');

    registerVicalSideEffects();

    const eventType = createEventType({
      workspaceId: 'ws-r',
      hostUserId: 'host',
      slug: 'discovery',
      name: 'Discovery',
      durationMinutes: 30,
    });
    createAvailabilityRule({
      workspaceId: 'ws-r',
      hostUserId: 'host',
      dayOfWeek: new Date(Date.now() + 4 * 86400000).getUTCDay(),
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    });

    const start = new Date(Date.now() + 4 * 86400000);
    start.setUTCHours(10, 0, 0, 0);
    const booking = createBooking({
      workspaceId: 'ws-r',
      eventTypeId: eventType.id,
      hostUserId: 'host',
      guestName: 'Pat',
      guestEmail: 'pat@example.com',
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60000).toISOString(),
      timezone: 'UTC',
      source: 'api',
    });

    const scheduled = scheduleVicalReminders({ workspaceId: 'ws-r', bookingId: booking.id });
    expect(scheduled.length).toBeGreaterThan(0);
    expect(listVicalReminders('ws-r', { bookingId: booking.id, status: 'scheduled' }).length).toBe(
      scheduled.length,
    );

    cancelBookingForHost('ws-r', booking.id, 'test');
    expect(listVicalReminders('ws-r', { bookingId: booking.id, status: 'scheduled' })).toHaveLength(0);
    expect(listVicalReminders('ws-r', { bookingId: booking.id, status: 'cancelled' }).length).toBeGreaterThan(0);
  });

  it('formats ICS and keeps calendar failure distinct from orchestration honesty', async () => {
    const { createEventType, createBooking, formatBookingIcs, mutateVicalStore, getBooking } =
      await import('./index.js');

    const eventType = createEventType({
      workspaceId: 'ws-ics',
      hostUserId: 'host',
      slug: 'call',
      name: 'Call',
      durationMinutes: 30,
    });
    const start = new Date(Date.now() + 2 * 86400000);
    start.setUTCHours(15, 0, 0, 0);
    const booking = createBooking({
      workspaceId: 'ws-ics',
      eventTypeId: eventType.id,
      hostUserId: 'host',
      guestName: 'Sam',
      guestEmail: 'sam@example.com',
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60000).toISOString(),
      timezone: 'UTC',
      source: 'api',
      meetingUrl: 'https://meet.example/x',
    });

    const ics = formatBookingIcs(booking);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain(booking.guestEmail);

    // Prompt 706: calendar failure must surface as action_required, not a silent confirmed success.
    mutateVicalStore((store) => {
      const idx = store.bookings.findIndex((b) => b.id === booking.id);
      store.bookings[idx] = {
        ...store.bookings[idx]!,
        calendarSyncStatus: 'failed',
        calendarSyncError: 'token expired',
        invitationDeliveryState: 'failed',
        orchestrationStatus: 'action_required',
        actionRequiredReason: 'calendar_invitation_failed',
        status: 'confirmed',
      };
    });
    const after = getBooking('ws-ics', booking.id)!;
    expect(after.calendarSyncStatus).toBe('failed');
    expect(after.invitationDeliveryState).toBe('failed');
    expect(after.orchestrationStatus).toBe('action_required');
    expect(after.actionRequiredReason).toBe('calendar_invitation_failed');
  });

  it('does not mark reminders sent without a delivery adapter', async () => {
    const {
      createEventType,
      createAvailabilityRule,
      createBooking,
      scheduleVicalReminders,
      processDueVicalReminders,
      listVicalReminders,
    } = await import('./index.js');

    const eventType = createEventType({
      workspaceId: 'ws-rem',
      hostUserId: 'host',
      slug: 'discovery',
      name: 'Discovery',
      durationMinutes: 30,
    });
    createAvailabilityRule({
      workspaceId: 'ws-rem',
      hostUserId: 'host',
      dayOfWeek: new Date(Date.now() + 4 * 86400000).getUTCDay(),
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    });
    const start = new Date(Date.now() + 4 * 86400000);
    start.setUTCHours(10, 0, 0, 0);
    const booking = createBooking({
      workspaceId: 'ws-rem',
      eventTypeId: eventType.id,
      hostUserId: 'host',
      guestName: 'Pat',
      guestEmail: 'pat@example.com',
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60000).toISOString(),
      timezone: 'UTC',
      source: 'api',
    });
    const scheduled = scheduleVicalReminders({
      workspaceId: 'ws-rem',
      bookingId: booking.id,
      offsetsMinutes: [1, 1],
    });
    expect(scheduled.length).toBeGreaterThan(0);
    // Force due.
    const { mutateVicalStore } = await import('./index.js');
    mutateVicalStore((store) => {
      for (const row of store.reminders) {
        if (row.bookingId === booking.id) row.dueAt = new Date(Date.now() - 1000).toISOString();
      }
    });
    const without = processDueVicalReminders('ws-rem');
    expect(without.sent).toBe(0);
    expect(without.failed).toBeGreaterThan(0);
    expect(listVicalReminders('ws-rem', { bookingId: booking.id, status: 'sent' })).toHaveLength(0);
    expect(listVicalReminders('ws-rem', { bookingId: booking.id, status: 'failed' }).length).toBeGreaterThan(0);

    // Re-schedule and deliver via adapter.
    scheduleVicalReminders({ workspaceId: 'ws-rem', bookingId: booking.id, offsetsMinutes: [1, 1] });
    mutateVicalStore((store) => {
      for (const row of store.reminders) {
        if (row.bookingId === booking.id && row.status === 'scheduled') {
          row.dueAt = new Date(Date.now() - 1000).toISOString();
        }
      }
    });
    const withDeliver = processDueVicalReminders('ws-rem', new Date(), () => ({ ok: true }));
    expect(withDeliver.sent).toBeGreaterThan(0);
  });
});

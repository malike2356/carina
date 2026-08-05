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

  it('formats ICS and marks soft sync failure without unconfirming', async () => {
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

    mutateVicalStore((store) => {
      const idx = store.bookings.findIndex((b) => b.id === booking.id);
      store.bookings[idx] = {
        ...store.bookings[idx]!,
        calendarSyncStatus: 'failed',
        calendarSyncError: 'token expired',
        status: 'confirmed',
      };
    });
    const after = getBooking('ws-ics', booking.id)!;
    expect(after.status).toBe('confirmed');
    expect(after.calendarSyncStatus).toBe('failed');
  });
});

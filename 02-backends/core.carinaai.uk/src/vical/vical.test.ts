import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('vical booking engine', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-vical-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  async function load() {
    return import('./index.js');
  }

  it('seeds discovery defaults and offers evening-only slots', async () => {
    const vical = await load();
    const workspaceId = 'ws-1';
    const hostUserId = 'host-1';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId });

    // Wednesday 2026-08-05 is evening-eligible under default Mon-Thu windows.
    const from = new Date('2026-08-05T10:00:00.000Z');
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from,
      limit: 5,
    });

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const hour = new Date(slot.start).getUTCHours();
      expect(hour).toBeGreaterThanOrEqual(18);
      expect(hour).toBeLessThan(21);
    }
  });

  it('never offers weekend slots with Mon-Thu evening windows', async () => {
    const vical = await load();
    const workspaceId = 'ws-2';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: 'host-2' });
    // Saturday
    const from = new Date('2026-08-08T10:00:00.000Z');
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from,
      limit: 20,
    });
    const saturdayOrSunday = slots.filter((s) => {
      const day = new Date(s.start).getUTCDay();
      return day === 0 || day === 6;
    });
    expect(saturdayOrSunday).toHaveLength(0);
  });

  it('creates confirmed booking with guest token and blocks double book', async () => {
    const vical = await load();
    const workspaceId = 'ws-3';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: 'host-3' });
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 3,
    });
    expect(slots[0]).toBeTruthy();
    const first = vical.createBooking({
      workspaceId,
      eventTypeId: eventType.id,
      guestName: 'Anna',
      guestEmail: 'anna@example.com',
      startsAt: slots[0]!.start,
      source: 'agent',
    });
    expect(first.status).toBe('confirmed');
    expect(first.guestToken.length).toBeGreaterThan(10);

    expect(() =>
      vical.createBooking({
        workspaceId,
        eventTypeId: eventType.id,
        guestName: 'Bob',
        guestEmail: 'bob@example.com',
        startsAt: slots[0]!.start,
        source: 'public',
      }),
    ).toThrow(/slot/i);
  });

  it('requires approval when event type flag is set', async () => {
    const vical = await load();
    const workspaceId = 'ws-4';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: 'host-4' });
    vical.updateEventType(workspaceId, eventType.id, { requiresApproval: true });
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 1,
    });
    const booking = vical.createBooking({
      workspaceId,
      eventTypeId: eventType.id,
      guestName: 'Cara',
      guestEmail: 'cara@example.com',
      startsAt: slots[0]!.start,
    });
    expect(booking.status).toBe('pending_review');
    const approved = vical.approveBooking(workspaceId, booking.id);
    expect(approved.status).toBe('confirmed');
  });

  it('supports guest cancel by token and host reschedule', async () => {
    const vical = await load();
    const workspaceId = 'ws-5';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: 'host-5' });
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 5,
    });
    const booking = vical.createBooking({
      workspaceId,
      eventTypeId: eventType.id,
      guestName: 'Dan',
      guestEmail: 'dan@example.com',
      startsAt: slots[0]!.start,
    });
    const moved = vical.rescheduleBooking({
      workspaceId,
      bookingId: booking.id,
      startsAt: slots[1]!.start,
    });
    expect(moved.startsAt).toBe(slots[1]!.start);
    expect(moved.previousStartsAt).toBe(slots[0]!.start);

    const cancelled = vical.cancelBookingForGuest(moved.guestToken);
    expect(cancelled.status).toBe('cancelled');
  });

  it('records session outcome without deleting history', async () => {
    const vical = await load();
    const workspaceId = 'ws-6';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: 'host-6' });
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 1,
    });
    const booking = vical.createBooking({
      workspaceId,
      eventTypeId: eventType.id,
      guestName: 'Eve',
      guestEmail: 'eve@example.com',
      startsAt: slots[0]!.start,
    });
    const outcome = vical.setSessionOutcome(workspaceId, booking.id, 'no_show');
    expect(outcome.sessionOutcome).toBe('no_show');
    expect(vical.getBooking(workspaceId, booking.id)?.status).toBe('confirmed');
  });

  it('rejects second concurrent lock on same slot', async () => {
    const vical = await load();
    const start = '2026-08-05T18:00:00.000Z';
    const end = '2026-08-05T18:30:00.000Z';
    const first = vical.acquireSlotLock({
      workspaceId: 'ws-7',
      hostUserId: 'host-7',
      startsAt: start,
      endsAt: end,
    });
    expect(first.holderToken).toBeTruthy();
    expect(() =>
      vical.acquireSlotLock({
        workspaceId: 'ws-7',
        hostUserId: 'host-7',
        startsAt: start,
        endsAt: end,
      }),
    ).toThrow(/lock/i);
  });

  it('createFromOutreach uses discovery event type', async () => {
    const vical = await load();
    const workspaceId = 'ws-8';
    const { eventType } = vical.ensureDiscoveryDefaults({ workspaceId, hostUserId: 'host-8' });
    const slots = vical.listOfferedSlots({
      workspaceId,
      eventTypeId: eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 1,
    });
    const booking = vical.createFromOutreach({
      workspaceId,
      leadId: 'lead-1',
      email: 'lead@example.com',
      name: 'Lead',
      startsAt: slots[0]!.start,
    });
    expect(booking.source).toBe('outreach');
    expect(booking.leadId).toBe('lead-1');
    expect(booking.eventTypeId).toBe(eventType.id);
  });

  it('isolates bookings by workspace', async () => {
    const vical = await load();
    const a = vical.ensureDiscoveryDefaults({ workspaceId: 'ws-a', hostUserId: 'h-a' });
    const b = vical.ensureDiscoveryDefaults({ workspaceId: 'ws-b', hostUserId: 'h-b' });
    const slotA = vical.listOfferedSlots({
      workspaceId: 'ws-a',
      eventTypeId: a.eventType.id,
      from: new Date('2026-08-05T10:00:00.000Z'),
      limit: 1,
    })[0]!;
    vical.createBooking({
      workspaceId: 'ws-a',
      eventTypeId: a.eventType.id,
      guestName: 'A',
      guestEmail: 'a@example.com',
      startsAt: slotA.start,
    });
    expect(vical.listBookings('ws-b')).toHaveLength(0);
    expect(vical.listBookings('ws-a')).toHaveLength(1);
    expect(vical.getEventType('ws-b', a.eventType.id)).toBeNull();
    expect(vical.getEventType('ws-b', b.eventType.id)?.id).toBe(b.eventType.id);
  });
});

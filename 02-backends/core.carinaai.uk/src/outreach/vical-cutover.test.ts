import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('outreach viCal cutover (merged booking engine)', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-vical-cutover-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('VICAL_OUTREACH_BACKEND', 'vical');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('creates viCal row and outreach mirror, blocks double book, moves lead', async () => {
    const { createLead, getLead } = await import('./leads.js');
    const { createBooking, listBookings, getBookingConfig } = await import('./bookings.js');
    const { listBookings: listVical } = await import('../vical/index.js');
    const { isVicalOutreachBackend } = await import('./vical-cutover.js');

    expect(isVicalOutreachBackend()).toBe(true);

    const { lead } = createLead({
      workspaceId: 'ws-cut',
      name: 'Ann',
      email: 'ann@example.com',
    });

    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    const startsAt = start.toISOString();
    const endsAt = new Date(start.getTime() + 30 * 60 * 1000).toISOString();

    const booking = createBooking({
      workspaceId: 'ws-cut',
      leadId: lead.id,
      startsAt,
      endsAt,
      timezone: 'UTC',
    });

    expect(booking.status).toBe('confirmed');
    expect(listBookings('ws-cut')).toHaveLength(1);
    expect(listVical('ws-cut')).toHaveLength(1);
    expect(listVical('ws-cut')[0]?.id).toBe(booking.id);
    expect(listVical('ws-cut')[0]?.source).toBe('outreach');
    expect(getLead('ws-cut', lead.id)?.status).toBe('booked');

    expect(() =>
      createBooking({
        workspaceId: 'ws-cut',
        leadId: lead.id,
        startsAt,
        endsAt,
      }),
    ).toThrow(/not available|filled|slot/i);

    const config = getBookingConfig('ws-cut');
    expect(config.windows.length).toBeGreaterThan(0);
  });

  it('legacy flag restores JSON-only create path', async () => {
    vi.stubEnv('VICAL_OUTREACH_BACKEND', 'legacy');
    vi.resetModules();
    const { createLead } = await import('./leads.js');
    const { createBooking } = await import('./bookings.js');
    const { listBookings: listVical } = await import('../vical/index.js');
    const { isVicalOutreachBackend } = await import('./vical-cutover.js');

    expect(isVicalOutreachBackend()).toBe(false);
    const { lead } = createLead({
      workspaceId: 'ws-legacy',
      name: 'Bea',
      email: 'bea@example.com',
    });
    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    createBooking({
      workspaceId: 'ws-legacy',
      leadId: lead.id,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
    });
    expect(listVical('ws-legacy')).toHaveLength(0);
  });

  it('backfills outreach JSON bookings into viCal', async () => {
    vi.stubEnv('VICAL_OUTREACH_BACKEND', 'legacy');
    vi.resetModules();
    const { createLead } = await import('./leads.js');
    const { createBooking, getBookingConfig, listBookings } = await import('./bookings.js');
    const { backfillOutreachBookingsToVical, listBookings: listVical } = await import('../vical/index.js');

    const { lead } = createLead({
      workspaceId: 'ws-bf',
      name: 'Cara',
      email: 'cara@example.com',
    });
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    const booking = createBooking({
      workspaceId: 'ws-bf',
      leadId: lead.id,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
    });
    expect(listVical('ws-bf')).toHaveLength(0);

    const result = backfillOutreachBookingsToVical({
      workspaceId: 'ws-bf',
      outreachBookings: listBookings('ws-bf'),
      config: getBookingConfig('ws-bf'),
    });
    expect(result.created).toBe(1);
    expect(listVical('ws-bf')[0]?.id).toBe(booking.id);

    const again = backfillOutreachBookingsToVical({
      workspaceId: 'ws-bf',
      outreachBookings: listBookings('ws-bf'),
      config: getBookingConfig('ws-bf'),
    });
    expect(again.created).toBe(0);
    expect(again.skipped).toBeGreaterThan(0);
  });
});

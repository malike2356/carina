import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('outreach O03/O04/O05', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-outreach-funnel-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('classifies reply intent and routes reply to review/lead', async () => {
    const { createLead } = await import('./leads.js');
    const { classifyReplyText, processInboundReply } = await import('./replies.js');

    expect(classifyReplyText('re: chat', 'Can we book a call next week?').classification).toBe('interested');
    expect(classifyReplyText('re', 'Too expensive for us right now').classification).toBe('objection');
    expect(classifyReplyText('re', 'Not interested, thanks').classification).toBe('not_interested');

    createLead({
      workspaceId: 'ws-1',
      name: 'Pat Buyer',
      email: 'pat@example.com',
      company: 'Buyer Co',
    });

    const result = processInboundReply({
      workspaceId: 'ws-1',
      fromEmail: 'pat@example.com',
      subject: 'Re: discovery',
      body: 'Sounds good, send times so we can book a meeting.',
    });
    expect(result.classification).toBe('interested');
    expect(result.lead?.bookingState).toBe('offered');
    expect(result.actionTaken).toBe('booking');
  });

  it('books a slot with conflict protection, reminders, and no-show follow-up', async () => {
    const { createLead } = await import('./leads.js');
    const {
      createBooking,
      listAvailability,
      cancelBooking,
      markBookingNoShow,
      getBookingConfig,
      updateBookingConfig,
    } = await import('./bookings.js');
    const { listReminders, processDueReminders, cancelRemindersForBooking } = await import('./reminders.js');

    const { lead } = createLead({
      workspaceId: 'ws-1',
      name: 'Sam',
      email: 'sam@example.com',
    });

    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    // Align to a likely business slot generator using Z wall clock.
    const startsAt = start.toISOString();
    const endsAt = new Date(start.getTime() + 30 * 60 * 1000).toISOString();

    const booking = createBooking({
      workspaceId: 'ws-1',
      leadId: lead.id,
      startsAt,
      endsAt,
      timezone: 'UTC',
    });
    expect(booking.status).toBe('confirmed');
    expect(booking.confirmationStatus).toBe('pending_approval');
    expect(listReminders('ws-1', { bookingId: booking.id }).length).toBeGreaterThan(0);

    expect(() =>
      createBooking({
        workspaceId: 'ws-1',
        leadId: lead.id,
        startsAt,
        endsAt,
      }),
    ).toThrow(/not available/i);

    const currentConfig = getBookingConfig('ws-1');
    expect(currentConfig.timezone).toBe('Europe/London');
    const updatedConfig = updateBookingConfig('ws-1', {
      timezone: 'UTC',
      slotMinutes: 45,
      bufferMinutes: 15,
      horizonDays: 10,
      meetingMode: 'zoom',
      zoomRoomUrl: 'https://zoom.example.com/j/123',
    });
    expect(updatedConfig.timezone).toBe('UTC');
    expect(updatedConfig.slotMinutes).toBe(45);
    expect(updatedConfig.meetingMode).toBe('zoom');

    const dueAt = new Date(Date.now() + 60_000).toISOString();
    // Force a due reminder by rewriting store through cancel + reprocess path
    cancelRemindersForBooking('ws-1', booking.id, 'test_reset');
    const { mutateOutreachStore } = await import('./store.js');
    mutateOutreachStore((store) => {
      store.reminders.push({
        id: 'rem-1',
        workspaceId: 'ws-1',
        bookingId: booking.id,
        leadId: lead.id,
        kind: '1h',
        templateKey: 'discovery',
        dueAt: new Date(Date.now() - 1000).toISOString(),
        status: 'scheduled',
        subject: 'soon',
        body: 'body',
        createdAt: dueAt,
        updatedAt: dueAt,
      });
    });
    const processed = processDueReminders('ws-1');
    expect(processed.sent).toHaveLength(1);

    cancelBooking('ws-1', booking.id, 'changed plans');
    expect((await import('./reminders.js')).listReminders('ws-1', { bookingId: booking.id, status: 'cancelled' }).length).toBeGreaterThan(0);
    const again = listAvailability({
      workspaceId: 'ws-1',
      from: new Date(),
      days: 5,
      timezone: 'UTC',
    });
    expect(Array.isArray(again)).toBe(true);

    const second = createBooking({
      workspaceId: 'ws-1',
      leadId: lead.id,
      startsAt: new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(start.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
    });
    markBookingNoShow('ws-1', second.id);
    const { getLead } = await import('./leads.js');
    expect(getLead('ws-1', lead.id)?.status).toBe('follow_up');
    expect(getLead('ws-1', lead.id)?.bookingState).toBe('no_show');
  });

  it('renders the booking confirmation with prep video details and skips a second send', async () => {
    const { createLead } = await import('./leads.js');
    const {
      createBooking,
      buildBookingConfirmationEmail,
      sendBookingConfirmationEmail,
      markBookingConfirmationSent,
    } = await import('./bookings.js');

    const { lead } = createLead({
      workspaceId: 'ws-1',
      name: 'Nia',
      email: 'nia@example.com',
    });

    const start = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    const booking = createBooking({
      workspaceId: 'ws-1',
      leadId: lead.id,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      timezone: 'UTC',
      joinLink: 'https://meet.example.com/abc',
    });

    const rendered = buildBookingConfirmationEmail({
      leadName: 'Nia',
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      timezone: 'UTC',
      joinLink: booking.joinLink,
      prepVideoUrl: 'https://youtu.be/example',
      prepVideoTitle: 'Discovery prep',
      prepVideoPassword: '1234',
    });
    expect(rendered.subject).toContain('Confirmed: discovery call');
    expect(rendered.body).toContain('https://youtu.be/example');
    expect(rendered.body).toContain('Discovery prep');
    expect(rendered.body).toContain('1234');

    markBookingConfirmationSent('ws-1', booking.id);
    const skipped = await sendBookingConfirmationEmail({
      workspaceId: 'ws-1',
      bookingId: booking.id,
      workerId: 'worker-1',
      prepVideoUrl: 'https://youtu.be/example',
    });
    expect(skipped.skipped).toBe(true);
  });

  it('records a post-call outcome and schedules the matching handoff task', async () => {
    const { createLead, getLead } = await import('./leads.js');
    const { createBooking, recordPostCallOutcome } = await import('./bookings.js');
    const { listFollowUpTasks } = await import('./follow-ups.js');

    const { lead } = createLead({
      workspaceId: 'ws-1',
      name: 'Maya Prospect',
      email: 'maya@example.com',
    });

    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    const booking = createBooking({
      workspaceId: 'ws-1',
      leadId: lead.id,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      timezone: 'UTC',
    });

    const result = recordPostCallOutcome({
      workspaceId: 'ws-1',
      bookingId: booking.id,
      outcome: 'proposal_needed',
      notes: 'Need scope and pricing details.',
    });

    expect(result.leadId).toBe(lead.id);
    expect(result.nextActionTaskId).toBeTruthy();
    expect(getLead('ws-1', lead.id)?.status).toBe('proposal_sent');
    expect(getLead('ws-1', lead.id)?.bookingState).toBe('attended');
    expect(getLead('ws-1', lead.id)?.notes).toContain('Need scope and pricing details.');
    expect(listFollowUpTasks('ws-1').some((task) => task.kind === 'post_call_proposal_draft')).toBe(true);
  });
});

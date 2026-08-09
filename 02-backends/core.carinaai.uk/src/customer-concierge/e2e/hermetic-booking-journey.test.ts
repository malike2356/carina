/**
 * Prompt 706: hermetic end-to-end Customer Concierge booking journey.
 * Uses fake Zoom + Google sync; never writes to live providers.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeGoogleCalendarSync, fakeZoomAdapter } from './fakes/oauth-providers.js';
import { forgedZoomWebhookFixture, zoomMeetingCreatedFixture } from './fakes/webhook-fixtures.js';

describe('customer concierge hermetic e2e journey (706)', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-cc-e2e-'));
    fs.mkdirSync(path.join(tmpHome, 'customer-concierge'), { recursive: true });
    fs.mkdirSync(path.join(tmpHome, 'outreach'), { recursive: true });
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('ZOOM_WEBHOOK_SECRET', 'zoom_webhook_secret_synth');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('visitor support → booking → zoom/calendar → outreach stop → analytics', async () => {
    const vical = await import('../../vical/index.js');
    const {
      emptyOutreachStore,
      resetOutreachStoreCache,
      saveOutreachStore,
    } = await import('../../outreach/store.js');
    const { createLead } = await import('../../outreach/leads.js');
    const { createSequence, enrollLead, listEnrollments } = await import('../../outreach/sequence-engine.js');
    const { onBookingConfirmed, onBookingCancelled } = await import('../outreach-hooks.js');
    const { appendConciergeEvent, listConciergeEvents, resetConciergeEventStoreCache } =
      await import('../events.js');
    const { buildConciergeAnalytics } = await import('../analytics.js');
    const { buildGroundedAnswer } = await import('../published-knowledge.js');
    const { isCustomerConciergeToolAllowed } = await import('../tool-policy.js');
    const { verifyZoomWebhookSignature } = await import('../../vical/index.js');

    resetConciergeEventStoreCache();
    resetOutreachStoreCache();
    saveOutreachStore(emptyOutreachStore());

    // Support / knowledge boundary
    expect(isCustomerConciergeToolAllowed('shell-exec')).toBe(false);
    const grounded = buildGroundedAnswer({
      query: 'hours',
      hits: [{
        id: 'k1',
        title: 'Hours',
        type: 'faq',
        excerpt: 'Open weekdays 9-5',
        revision: 1,
        publishState: 'published',
        confidence: 0.9,
      }],
    });
    expect(grounded.grounded).toBe(true);

    appendConciergeEvent({
      eventType: 'conversation.started',
      workspaceId: 'ws_e2e',
      workerId: 'w_e2e',
      actorType: 'audience',
      payload: { audienceSessionId: 'sess_e2e', channel: 'web', message: 'secret body must redact' },
    });

    // Contact / lead
    const { lead } = createLead({
      workspaceId: 'ws_e2e',
      name: 'Synth Guest',
      email: 'guest@example.test',
      source: 'manual',
    });
    const sequence = createSequence({
      workspaceId: 'ws_e2e',
      name: 'Sales cadence',
      steps: [{ subject: 'Hi', body: 'Hello', delayHours: 0 }],
    });
    enrollLead({ workspaceId: 'ws_e2e', leadId: lead.id, sequenceId: sequence.id });

    // Slot / booking via saga with fakes
    const eventType = vical.createEventType({
      workspaceId: 'ws_e2e',
      hostUserId: 'w_e2e',
      slug: 'intro',
      name: 'Intro',
      durationMinutes: 30,
      locationMode: 'zoom',
    });
    vical.createAvailabilityRule({
      workspaceId: 'ws_e2e',
      hostUserId: 'w_e2e',
      dayOfWeek: new Date(Date.now() + 3 * 86400000).getUTCDay(),
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    });
    const start = new Date(Date.now() + 3 * 86400000);
    start.setUTCHours(11, 0, 0, 0);

    const zoom = fakeZoomAdapter({ mode: 'ok' });
    const syncCalendar = fakeGoogleCalendarSync({ fail: false });
    const booked = await vical.bookWithSaga(
      {
        workspaceId: 'ws_e2e',
        workerId: 'w_e2e',
        eventTypeId: eventType.id,
        guestName: lead.name,
        guestEmail: lead.email!,
        startsAt: start.toISOString(),
        source: 'widget',
        leadId: lead.id,
        preferManagedZoom: true,
      },
      { zoomAdapter: zoom, syncCalendar: syncCalendar as never },
    );

    expect(booked.actionRequired).toBe(false);
    expect(booked.booking.meetingUrl).toMatch(/zoom\.us/);
    expect(booked.publicBooking).not.toHaveProperty('hostStartUrl');
    expect(String(JSON.stringify(booked.publicBooking))).not.toMatch(/start_url|hostStart/i);
    expect(booked.booking.calendarEventId).toBeTruthy();
    expect(booked.booking.invitationDeliveryState).toBe('sent');
    expect(zoom.creates).toBe(1);

    // ICS fallback exists
    const ics = vical.formatBookingIcs(booked.booking);
    expect(ics).toContain('BEGIN:VEVENT');

    // Outreach stop + analytics
    onBookingConfirmed({
      workspaceId: 'ws_e2e',
      workerId: 'w_e2e',
      bookingId: booked.booking.id,
      leadId: lead.id,
      guestEmail: lead.email,
    });
    expect(listEnrollments('ws_e2e', { leadId: lead.id }).every((e) => e.status === 'stopped')).toBe(true);

    // Reminders: honest non-delivery without adapter
    const reminders = vical.scheduleVicalReminders({
      workspaceId: 'ws_e2e',
      bookingId: booked.booking.id,
      offsetsMinutes: [1, 1],
    });
    expect(reminders.length).toBeGreaterThan(0);
    vical.mutateVicalStore((store) => {
      for (const row of store.reminders) {
        if (row.bookingId === booked.booking.id) row.dueAt = new Date(Date.now() - 1000).toISOString();
      }
    });
    const due = vical.processDueVicalReminders('ws_e2e');
    expect(due.sent).toBe(0);
    expect(due.failed).toBeGreaterThan(0);

    // Reschedule + cancel path
    const later = new Date(start.getTime() + 3600_000);
    const rescheduled = await vical.rescheduleWithSaga(
      {
        workspaceId: 'ws_e2e',
        workerId: 'w_e2e',
        bookingId: booked.booking.id,
        startsAt: later.toISOString(),
      },
      { zoomAdapter: zoom, syncCalendar: syncCalendar as never, updateCalendar: syncCalendar as never },
    );
    expect(rescheduled.booking.startsAt).toBe(later.toISOString());

    const cancelled = await vical.cancelWithSaga(
      {
        workspaceId: 'ws_e2e',
        workerId: 'w_e2e',
        bookingId: booked.booking.id,
        reason: 'guest_request',
      },
      { zoomAdapter: zoom },
    );
    expect(cancelled.booking.status).toBe('cancelled');
    onBookingCancelled({
      workspaceId: 'ws_e2e',
      workerId: 'w_e2e',
      bookingId: booked.booking.id,
      leadId: lead.id,
      guestEmail: lead.email,
    });

    const events = listConciergeEvents({ workspaceId: 'ws_e2e', workerId: 'w_e2e', limit: 50 });
    expect(events.some((e) => e.payload.message === '[REDACTED_CONTENT]')).toBe(true);
    const analytics = await buildConciergeAnalytics({ workspaceId: 'ws_e2e', workerId: 'w_e2e' });
    expect(analytics.conversations.started).toBeGreaterThanOrEqual(1);
    expect(analytics.eventsSampled).toBeGreaterThan(0);

    // Webhook forgery rejection (signature helpers)
    const forged = forgedZoomWebhookFixture('999');
    const good = zoomMeetingCreatedFixture({ meetingId: '111' });
    expect(forged.headers['x-zm-signature']).not.toBe(good.headers['x-zm-signature']);
    expect(typeof verifyZoomWebhookSignature).toBe('function');
    expect(
      verifyZoomWebhookSignature({
        rawBody: forged.body,
        signature: forged.headers['x-zm-signature']!,
        timestamp: forged.headers['x-zm-request-timestamp']!,
        secret: 'zoom_webhook_secret_synth',
      }),
    ).toBe(false);
  });

  it('marks action_required when Zoom credentials fail (no fake success)', async () => {
    const vical = await import('../../vical/index.js');
    const eventType = vical.createEventType({
      workspaceId: 'ws_fail',
      hostUserId: 'w_fail',
      slug: 'intro',
      name: 'Intro',
      durationMinutes: 30,
      locationMode: 'zoom',
    });
    vical.createAvailabilityRule({
      workspaceId: 'ws_fail',
      hostUserId: 'w_fail',
      dayOfWeek: new Date(Date.now() + 2 * 86400000).getUTCDay(),
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    });
    const start = new Date(Date.now() + 2 * 86400000);
    start.setUTCHours(10, 0, 0, 0);
    const result = await vical.bookWithSaga(
      {
        workspaceId: 'ws_fail',
        workerId: 'w_fail',
        eventTypeId: eventType.id,
        guestName: 'Fail Guest',
        guestEmail: 'fail@example.test',
        startsAt: start.toISOString(),
        preferManagedZoom: true,
      },
      {
        zoomAdapter: fakeZoomAdapter({ mode: 'revoked' }),
        syncCalendar: fakeGoogleCalendarSync({ fail: false }) as never,
      },
    );
    expect(result.actionRequired).toBe(true);
    expect(result.booking.orchestrationStatus).toBe('action_required');
  });
});

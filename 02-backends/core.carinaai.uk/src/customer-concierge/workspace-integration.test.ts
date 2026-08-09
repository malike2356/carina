/**
 * Prompt 705: outreach pause/resume audit + analytics redaction.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  appendConciergeEvent,
  listConciergeEvents,
  resetConciergeEventStoreCache,
  redactConciergePayload,
} from './events.js';
import { assertNoMessageBodiesInAnalyticsPayload, buildConciergeAnalytics } from './analytics.js';
import {
  onBookingConfirmed,
  onBookingCancelled,
  operatorResumeEnrollment,
  pauseOutreachForSupportCase,
} from './outreach-hooks.js';
import {
  createSequence,
  enrollLead,
  listEnrollments,
} from '../outreach/sequence-engine.js';
import { createLead } from '../outreach/leads.js';
import {
  emptyOutreachStore,
  resetOutreachStoreCache,
  saveOutreachStore,
} from '../outreach/store.js';

describe('customer concierge workspace integration (705)', () => {
  let home: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'concierge-705-'));
    mkdirSync(join(home, 'customer-concierge'), { recursive: true });
    mkdirSync(join(home, 'outreach'), { recursive: true });
    process.env.CARINA_HOME = home;
    resetConciergeEventStoreCache();
    resetOutreachStoreCache();
    saveOutreachStore(emptyOutreachStore());
  });

  afterEach(() => {
    resetConciergeEventStoreCache();
    resetOutreachStoreCache();
    try {
      rmSync(home, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('redacts message bodies from durable events', () => {
    const event = appendConciergeEvent({
      eventType: 'conversation.started',
      workspaceId: 'ws_1',
      workerId: 'w_1',
      actorType: 'audience',
      payload: {
        message: 'Secret customer complaint about pricing',
        audienceSessionId: 'sess_1',
      },
    });
    expect(event.payload.message).toBe('[REDACTED_CONTENT]');
    expect(event.payload.messageLength).toBeGreaterThan(10);
    expect(redactConciergePayload({ body: 'hello world forever' }).body).toBe('[REDACTED_CONTENT]');
  });

  it('pauses nurture on support case and resumes with audit', () => {
    const { lead } = createLead({
      workspaceId: 'ws_1',
      name: 'Alex Buyer',
      email: 'alex@example.com',
      source: 'manual',
    });
    const sequence = createSequence({
      workspaceId: 'ws_1',
      name: 'Nurture',
      steps: [
        { subject: 'Hi', body: 'Hello {{name}}', delayHours: 0 },
        { subject: 'Follow up', body: 'Still interested?', delayHours: 24 },
      ],
    });
    const enrollment = enrollLead({
      workspaceId: 'ws_1',
      leadId: lead.id,
      sequenceId: sequence.id,
    });
    expect(enrollment.status).toBe('active');

    const paused = pauseOutreachForSupportCase({
      workspaceId: 'ws_1',
      workerId: 'w_1',
      caseId: 'case_1',
      leadId: lead.id,
      guestEmail: lead.email,
    });
    expect(paused).toHaveLength(1);
    expect(paused[0]!.status).toBe('paused');
    expect(paused[0]!.stopReason).toBe('support_case');

    const resumed = operatorResumeEnrollment({
      workspaceId: 'ws_1',
      workerId: 'w_1',
      enrollmentId: enrollment.id,
      actorId: 'op_1',
    });
    expect(resumed?.status).toBe('active');
    expect(resumed?.stopReason).toBeUndefined();

    const events = listConciergeEvents({ workspaceId: 'ws_1', workerId: 'w_1', limit: 20 });
    expect(events.some((e) => e.eventType === 'support_case.opened')).toBe(true);
    expect(events.some((e) => String(e.payload.summary ?? '').includes('resumed'))).toBe(true);
  });

  it('stops cadence on booking confirm and keeps stop on cancel by default', () => {
    const { lead } = createLead({
      workspaceId: 'ws_1',
      name: 'Sam Prospect',
      email: 'sam@example.com',
      source: 'manual',
    });
    const sequence = createSequence({
      workspaceId: 'ws_1',
      name: 'Sales',
      steps: [{ subject: 'Intro', body: 'Hi', delayHours: 0 }],
    });
    enrollLead({ workspaceId: 'ws_1', leadId: lead.id, sequenceId: sequence.id });

    onBookingConfirmed({
      workspaceId: 'ws_1',
      workerId: 'w_1',
      bookingId: 'bk_1',
      leadId: lead.id,
      guestEmail: lead.email,
    });
    const afterBook = listEnrollments('ws_1', { leadId: lead.id });
    expect(afterBook.every((e) => e.status === 'stopped' && e.stopReason === 'booking')).toBe(true);

    onBookingCancelled({
      workspaceId: 'ws_1',
      workerId: 'w_1',
      bookingId: 'bk_1',
      leadId: lead.id,
      guestEmail: lead.email,
      policy: 'keep_stopped',
    });
    const afterCancel = listEnrollments('ws_1', { leadId: lead.id });
    expect(afterCancel.every((e) => e.status === 'stopped')).toBe(true);

    const enrollmentId = afterCancel[0]!.id;
    const resumed = operatorResumeEnrollment({
      workspaceId: 'ws_1',
      workerId: 'w_1',
      enrollmentId,
    });
    expect(resumed?.status).toBe('active');
  });

  it('builds analytics without message bodies', async () => {
    appendConciergeEvent({
      eventType: 'conversation.started',
      workspaceId: 'ws_1',
      workerId: 'w_1',
      actorType: 'audience',
      payload: { message: 'should be redacted in store' },
    });
    appendConciergeEvent({
      eventType: 'booking.confirmed',
      workspaceId: 'ws_1',
      workerId: 'w_1',
      actorType: 'system',
      payload: { bookingId: 'bk_x' },
    });
    const events = listConciergeEvents({ workspaceId: 'ws_1', workerId: 'w_1' });
    expect(assertNoMessageBodiesInAnalyticsPayload(events)).toBe(true);

    const report = await buildConciergeAnalytics({
      workspaceId: 'ws_1',
      workerId: 'w_1',
    });
    expect(report.conversations.started).toBeGreaterThanOrEqual(1);
    expect(report.bookings.confirmed).toBeGreaterThanOrEqual(1);
    expect(report.revenue.note.toLowerCase()).toContain('message');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildTimelineTitle,
  classifyOutreachReply,
  defaultLeadStageForChannel,
  extractReplySummary,
  leadStageFromReply,
  replyTimelineKind,
} from './outreach';

describe('outreach helpers', () => {
  it('classifies unsubscribe replies first', () => {
    expect(classifyOutreachReply('Please stop contacting me')).toBe('unsubscribe');
  });

  it('classifies booking intent', () => {
    expect(classifyOutreachReply('Can we book a call next week?')).toBe('booking');
    expect(leadStageFromReply('booking')).toBe('booked');
  });

  it('classifies interest and questions', () => {
    expect(classifyOutreachReply('Yes please, tell me more')).toBe('interest');
    expect(classifyOutreachReply('What is your pricing?')).toBe('question');
    expect(replyTimelineKind('interest')).toBe('reply_received');
  });

  it('summarises reply text safely', () => {
    expect(extractReplySummary('  Hello there\n\nCan we talk?  ')).toBe('Hello there Can we talk?');
  });

  it('builds lead stage defaults by channel', () => {
    expect(defaultLeadStageForChannel('manual')).toBe('queued');
    expect(defaultLeadStageForChannel('email')).toBe('prospect');
  });

  it('builds timeline labels for key events', () => {
    expect(buildTimelineTitle('campaign_created', 'Q3 outreach')).toBe('Campaign created: Q3 outreach');
    expect(buildTimelineTitle('booking_created', 'Jane Doe')).toBe('Booking created for Jane Doe');
  });
});

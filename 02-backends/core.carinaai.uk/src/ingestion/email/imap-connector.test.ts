import { describe, expect, it } from 'vitest';
import { senderMatches } from './imap-connector.js';
import { emailPollCronExpression, emailPollLimit } from './email-poll-config.js';

describe('senderMatches', () => {
  it('matches exact sender addresses', () => {
    expect(senderMatches('manager@agency.co.uk', ['manager@agency.co.uk'])).toBe(true);
    expect(senderMatches('other@agency.co.uk', ['manager@agency.co.uk'])).toBe(false);
  });

  it('matches domain suffix entries', () => {
    expect(senderMatches('alice@agency.co.uk', ['@agency.co.uk'])).toBe(true);
    expect(senderMatches('bob@other.co.uk', ['@agency.co.uk'])).toBe(false);
  });
});

describe('emailPollCronExpression', () => {
  it('defaults to every 5 minutes', () => {
    const previous = process.env.AIVA_EMAIL_POLL_CRON;
    delete process.env.AIVA_EMAIL_POLL_CRON;
    expect(emailPollCronExpression()).toBe('*/5 * * * *');
    if (previous !== undefined) process.env.AIVA_EMAIL_POLL_CRON = previous;
  });
});

describe('emailPollLimit', () => {
  it('defaults to 25 and caps at 100', () => {
    const prev = process.env.AIVA_EMAIL_POLL_LIMIT;
    delete process.env.AIVA_EMAIL_POLL_LIMIT;
    expect(emailPollLimit()).toBe(25);
    process.env.AIVA_EMAIL_POLL_LIMIT = '500';
    expect(emailPollLimit()).toBe(100);
    if (prev !== undefined) process.env.AIVA_EMAIL_POLL_LIMIT = prev;
    else delete process.env.AIVA_EMAIL_POLL_LIMIT;
  });
});

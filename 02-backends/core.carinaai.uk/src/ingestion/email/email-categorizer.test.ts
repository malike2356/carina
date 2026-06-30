import { describe, expect, it } from 'vitest';
import { categorizeEmail } from './email-categorizer.js';

describe('categorizeEmail', () => {
  it('flags spam patterns', () => {
    expect(
      categorizeEmail({
        from: 'promo@mailer.com',
        subject: 'You have won the lottery',
        body: 'Click unsubscribe to opt out',
      }),
    ).toBe('spam');
  });

  it('flags urgent messages', () => {
    expect(
      categorizeEmail({
        from: 'client@example.com',
        subject: 'URGENT action required',
        body: 'Please respond ASAP',
      }),
    ).toBe('urgent');
  });

  it('flags invoices', () => {
    expect(
      categorizeEmail({
        from: 'accounts@vendor.com',
        subject: 'Invoice #1234',
        body: 'Payment due',
      }),
    ).toBe('invoice');
  });

  it('treats enquiries as client queries', () => {
    expect(
      categorizeEmail({
        from: 'client@example.com',
        subject: 'Quick question',
        body: 'Could you advise on our account?',
      }),
    ).toBe('client_query');
  });
});

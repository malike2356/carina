import { describe, expect, it } from 'vitest';
import { categorizeEmail, categoryLabel } from './email-categorizer.js';

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

  it('returns other for noreply automated emails with no matching pattern', () => {
    expect(
      categorizeEmail({
        from: 'noreply@notifications.com',
        subject: 'Your weekly digest',
        body: 'Here is your summary for the week.',
      }),
    ).toBe('other');
  });

  it('forces client_query when roleTag is client regardless of sender', () => {
    expect(
      categorizeEmail({
        from: 'noreply@system.com',
        subject: 'System notification',
        body: 'Nothing interesting here.',
        roleTag: 'client',
      }),
    ).toBe('client_query');
  });

  it('flags overdue as urgent', () => {
    expect(
      categorizeEmail({
        from: 'supplier@vendor.com',
        subject: 'Overdue payment',
        body: 'Your account is overdue.',
      }),
    ).toBe('urgent');
  });

  it('flags billing sender domain as invoice', () => {
    expect(
      categorizeEmail({
        from: 'billing@service.com',
        subject: 'Monthly statement',
        body: 'Your monthly statement is attached.',
      }),
    ).toBe('invoice');
  });

  it('flags remittance keyword as invoice', () => {
    expect(
      categorizeEmail({
        from: 'finance@company.com',
        subject: 'Remittance advice',
        body: 'Please find attached remittance.',
      }),
    ).toBe('invoice');
  });
});

describe('categoryLabel', () => {
  it('returns human-readable label for each category', () => {
    expect(categoryLabel('client_query')).toBe('Client query');
    expect(categoryLabel('invoice')).toBe('Invoice');
    expect(categoryLabel('spam')).toBe('Spam');
    expect(categoryLabel('urgent')).toBe('Urgent');
    expect(categoryLabel('other')).toBe('Other');
  });
});

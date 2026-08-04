import { describe, expect, it } from 'vitest';
import { extractSmsToNumber, normalizeSmsNumber, smsAdapter } from './sms-adapter.js';

describe('sms-adapter', () => {
  it('normalizes phone numbers to E.164', () => {
    expect(normalizeSmsNumber('447700900000')).toBe('+447700900000');
    expect(normalizeSmsNumber('+447700900000')).toBe('+447700900000');
  });

  it('extracts Twilio To number from payload', () => {
    expect(extractSmsToNumber({ To: '+15551234567', From: '+15559876543', Body: 'Hi' })).toBe('+15551234567');
  });

  it('parses inbound SMS messages', () => {
    const inbound = smsAdapter.parse(
      { From: '+15559876543', To: '+15551234567', Body: 'Hello', MessageSid: 'SM123' },
      'worker-1',
      'workspace-1',
    );
    expect(inbound?.channel).toBe('sms');
    expect(inbound?.contactId).toBe('+15559876543');
    expect(inbound?.content).toBe('Hello');
  });
});

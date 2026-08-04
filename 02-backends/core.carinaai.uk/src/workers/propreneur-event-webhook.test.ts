import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../memory/db.js', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
}));

vi.mock('./worker-store.js', () => ({
  getWorkerById: vi.fn(async () => null),
}));

vi.mock('../channels/channel-store.js', () => ({
  listWorkerChannelDetails: vi.fn(async () => []),
  readChannelCredentials: vi.fn(() => ({})),
}));

vi.mock('../channels/worker-registry.js', () => ({
  lookupWorker: vi.fn(() => null),
}));

vi.mock('../channels/adapter-registry.js', () => ({
  getAdapter: vi.fn(() => null),
}));

import {
  checkPropreneurWebhookRateLimit,
  formatPropreneurEventMessage,
  resetPropreneurWebhookRateLimitsForTests,
  verifyPropreneurWebhookSignature,
} from './propreneur-event-webhook.js';

describe('propreneur-event-webhook', () => {
  beforeEach(() => {
    resetPropreneurWebhookRateLimitsForTests();
  });

  it('verifyPropreneurWebhookSignature accepts valid HMAC', () => {
    const body = JSON.stringify({ event: 'email_processed', workerId: 'w1' });
    const sig = `sha256=${createHmac('sha256', 'test-secret').update(body).digest('hex')}`;
    expect(verifyPropreneurWebhookSignature(body, sig, 'test-secret')).toBe(true);
  });

  it('verifyPropreneurWebhookSignature rejects invalid HMAC', () => {
    const body = '{"event":"email_processed"}';
    expect(verifyPropreneurWebhookSignature(body, 'sha256=deadbeef', 'test-secret')).toBe(false);
  });

  it('formatPropreneurEventMessage builds email_processed text', () => {
    const msg = formatPropreneurEventMessage({
      event: 'email_processed',
      workerId: 'w1',
      tenantSlug: 'xelox',
      data: { subject: 'Rent statement', sender: 'accountant@test.com', classification: 'rent_statement' },
    });
    expect(msg).toContain('Rent statement');
    expect(msg).toContain('rent_statement');
  });

  it('checkPropreneurWebhookRateLimit blocks after max hits', () => {
    const workerId = 'rate-worker';
    for (let i = 0; i < 10; i += 1) {
      expect(checkPropreneurWebhookRateLimit(workerId)).toBe(true);
    }
    expect(checkPropreneurWebhookRateLimit(workerId)).toBe(false);
  });
});

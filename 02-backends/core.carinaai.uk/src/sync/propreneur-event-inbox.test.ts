import { beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  enqueueMissingEventReplay,
  getPropreneurSyncHealth,
  ingestPropreneurWebhookEvent,
  resetPropreneurEventInboxForTests,
} from './propreneur-event-inbox.js';
import { verifyPropreneurWebhookSignature } from '../workers/propreneur-event-webhook.js';

describe('propreneur-event-inbox', () => {
  beforeEach(() => {
    resetPropreneurEventInboxForTests();
  });

  it('dedupes by event id', () => {
    const payload = {
      event: 'property.updated',
      event_id: 'evt-1',
      schema_version: '1.0.0',
      workerId: 'w1',
      tenantSlug: 'xelox',
      tenantId: 't1',
      resource_type: 'property',
      resource_id: '12',
      resource_version: 3,
      occurredAt: new Date().toISOString(),
      data: {},
    };
    const first = ingestPropreneurWebhookEvent(payload);
    const second = ingestPropreneurWebhookEvent(payload);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
    }
    const health = getPropreneurSyncHealth();
    expect(health.lastEventId).toBe('evt-1');
    expect(health.pendingCount).toBe(1);
  });

  it('rejects forged signatures at the verifier', () => {
    const body = JSON.stringify({ event: 'property.updated', event_id: 'evt-x' });
    const good = `sha256=${createHmac('sha256', 'real-secret').update(body).digest('hex')}`;
    expect(verifyPropreneurWebhookSignature(body, good, 'real-secret')).toBe(true);
    expect(verifyPropreneurWebhookSignature(body, good, 'other-secret')).toBe(false);
    expect(verifyPropreneurWebhookSignature(body, 'sha256=deadbeef', 'real-secret')).toBe(false);
  });

  it('exposes a missing-event replay stub', () => {
    const stub = enqueueMissingEventReplay('evt-missing');
    expect(stub.ok).toBe(true);
    expect(stub.stub).toBe(true);
    expect(stub.eventId).toBe('evt-missing');
  });
});

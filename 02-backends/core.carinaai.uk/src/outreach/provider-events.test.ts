import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  canTransitionDeliveryStatus,
  mapProviderKindToStatus,
  resolveNextDeliveryStatus,
  workspaceAllowsEngagementTracking,
} from './provider-events/state-machine.js';
import {
  normalizeMailgunDeliveryEvent,
  normalizeResendDeliveryEvent,
} from './provider-events/normalize.js';
import { verifyMailgunWebhookSignature } from '../ingestion/email/mailgun-inbound.js';

describe('provider delivery state machine', () => {
  it('maps kinds and blocks terminal regressions', () => {
    expect(mapProviderKindToStatus('delivered')).toBe('delivered');
    expect(mapProviderKindToStatus('hard_bounce')).toBe('bounced');
    expect(canTransitionDeliveryStatus('sent', 'delivered')).toBe(true);
    expect(canTransitionDeliveryStatus('bounced', 'delivered')).toBe(false);
    expect(canTransitionDeliveryStatus('replied', 'complained')).toBe(true);
    expect(resolveNextDeliveryStatus('delivered', 'sent').applied).toBe(false);
    expect(resolveNextDeliveryStatus('sent', 'delivered').next).toBe('delivered');
  });

  it('honours engagement tracking env', () => {
    vi.stubEnv('CARINA_OUTREACH_TRACK_OPENS_CLICKS', 'false');
    expect(workspaceAllowsEngagementTracking('ws-1')).toBe(false);
    vi.stubEnv('CARINA_OUTREACH_TRACK_OPENS_CLICKS', 'true');
    vi.stubEnv('CARINA_OUTREACH_TRACK_DENY_WORKSPACES', 'ws-deny');
    expect(workspaceAllowsEngagementTracking('ws-deny')).toBe(false);
    expect(workspaceAllowsEngagementTracking('ws-ok')).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe('provider event normalize', () => {
  it('normalizes Resend delivered + bounce soft/hard', () => {
    const delivered = normalizeResendDeliveryEvent({
      body: {
        type: 'email.delivered',
        data: {
          email_id: 're_123',
          to: ['ada@example.com'],
          tags: [
            { name: 'workspace_id', value: 'ws-1' },
            { name: 'delivery_id', value: 'del-1' },
          ],
          created_at: '2020-01-01T00:00:00.000Z',
        },
      },
      svixId: 'evt_1',
    });
    expect(delivered?.kind).toBe('delivered');
    expect(delivered?.providerMessageId).toBe('re_123');
    expect(delivered?.workspaceId).toBe('ws-1');
    expect(delivered?.deliveryId).toBe('del-1');

    const soft = normalizeResendDeliveryEvent({
      body: {
        type: 'email.bounced',
        data: { email_id: 're_2', bounce: { type: 'soft' } },
      },
      svixId: 'evt_2',
    });
    expect(soft?.kind).toBe('soft_bounce');
  });

  it('normalizes Mailgun failed severity to soft/hard bounce', () => {
    const hard = normalizeMailgunDeliveryEvent({
      body: {
        'event-data': {
          id: 'mg-1',
          event: 'failed',
          severity: 'permanent',
          recipient: 'ada@example.com',
          timestamp: 1577836800,
          message: { headers: { 'message-id': '<abc@mailgun>' } },
          'user-variables': { workspace_id: 'ws-1', delivery_id: 'del-9' },
        },
      },
    });
    expect(hard?.kind).toBe('hard_bounce');
    expect(hard?.providerMessageId).toBe('abc@mailgun');
    expect(hard?.deliveryId).toBe('del-9');
  });
});

describe('mailgun signature', () => {
  it('verifies HMAC and rejects bad signatures', () => {
    const key = 'test-signing-key';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'tok-abc';
    const signature = createHmac('sha256', key).update(`${timestamp}${token}`).digest('hex');
    expect(verifyMailgunWebhookSignature({ timestamp, token, signature, signingKey: key })).toBe(true);
    expect(verifyMailgunWebhookSignature({
      timestamp,
      token,
      signature: 'deadbeef',
      signingKey: key,
    })).toBe(false);
  });
});

describe('provider apply + suppression + reconcile', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-provider-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_OUTREACH_PERSISTENCE', 'json');
    vi.stubEnv('CARINA_OUTREACH_TRACK_OPENS_CLICKS', 'true');
    vi.stubEnv('DATABASE_URL', '');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  async function seedSentDelivery() {
    const { createLead } = await import('./leads.js');
    const { createSequence, enrollLead, processEnrollmentDueStep, markDeliveryStatus } = await import('./sequence-engine.js');
    const ws = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const { lead } = createLead({
      workspaceId: ws,
      name: 'Ada',
      email: 'ada@example.com',
      source: 'manual',
    });
    const sequence = createSequence({
      workspaceId: ws,
      name: 'Cold',
      steps: [{ subject: 'Hi {{name}}', body: 'Hello', delayHours: 0 }],
    });
    const enrollment = enrollLead({
      workspaceId: ws,
      leadId: lead.id,
      sequenceId: sequence.id,
      startAt: new Date('2020-01-01T12:00:00.000Z'),
    });
    const outcome = processEnrollmentDueStep(ws, enrollment.id, new Date('2020-01-01T12:00:00.000Z'));
    expect(outcome.kind).toBe('processed');
    if (outcome.kind !== 'processed') throw new Error('expected processed');
    const delivery = markDeliveryStatus(ws, outcome.delivery.id, 'sent', {
      providerMessageId: 're_msg_1',
      provider: 'resend',
      force: true,
    });
    return { ws, lead, delivery: delivery! };
  }

  it('persists send provider id and applies delivered then bounce with suppression', async () => {
    const { ws, lead, delivery } = await seedSentDelivery();
    expect(delivery.providerMessageId).toBe('re_msg_1');

    const { applyProviderEvent } = await import('./provider-events/apply.js');
    const { normalizeResendDeliveryEvent } = await import('./provider-events/normalize.js');
    const { getLead } = await import('./leads.js');
    const { loadOutreachStore } = await import('./store.js');

    const delivered = normalizeResendDeliveryEvent({
      body: {
        type: 'email.delivered',
        data: {
          email_id: 're_msg_1',
          tags: [
            { name: 'workspace_id', value: ws },
            { name: 'delivery_id', value: delivery.id },
          ],
        },
      },
      svixId: 'evt_delivered_1',
    })!;
    const d1 = await applyProviderEvent(delivered);
    expect(d1.ok).toBe(true);
    expect(d1.statusAfter).toBe('delivered');

    const bounce = normalizeResendDeliveryEvent({
      body: {
        type: 'email.bounced',
        data: {
          email_id: 're_msg_1',
          bounce: { type: 'hard' },
          tags: [
            { name: 'workspace_id', value: ws },
            { name: 'delivery_id', value: delivery.id },
          ],
        },
      },
      svixId: 'evt_bounce_1',
    })!;
    const d2 = await applyProviderEvent(bounce);
    expect(d2.statusAfter).toBe('bounced');
    const updatedLead = getLead(ws, lead.id);
    expect(updatedLead?.status).toBe('suppressed');

    // Late delivered must not regress bounced
    const late = await applyProviderEvent({
      ...delivered,
      providerEventId: 'evt_delivered_late',
      checksum: 'late',
    });
    expect(late.statusAfter === 'bounced' || late.reason?.includes('blocked_regression')).toBe(true);
    const final = loadOutreachStore().deliveries.find((d) => d.id === delivery.id);
    expect(final?.status).toBe('bounced');
  });

  it('rejects cross-workspace events and skips opens when tracking disabled', async () => {
    const { ws, delivery } = await seedSentDelivery();
    const { applyProviderEvent } = await import('./provider-events/apply.js');
    const { normalizeResendDeliveryEvent } = await import('./provider-events/normalize.js');

    const cross = normalizeResendDeliveryEvent({
      body: {
        type: 'email.delivered',
        data: {
          email_id: 're_msg_1',
          tags: [
            { name: 'workspace_id', value: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
            { name: 'delivery_id', value: delivery.id },
          ],
        },
      },
      svixId: 'evt_cross',
    })!;
    // Force match via delivery id on wrong workspace claim
    const result = await applyProviderEvent({
      ...cross,
      deliveryId: delivery.id,
      workspaceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      providerMessageId: 're_msg_1',
    });
    expect(result.rejected).toBe(true);
    expect(result.reason).toBe('cross_workspace');

    vi.stubEnv('CARINA_OUTREACH_TRACK_OPENS_CLICKS', 'false');
    const open = normalizeResendDeliveryEvent({
      body: {
        type: 'email.opened',
        data: {
          email_id: 're_msg_1',
          tags: [
            { name: 'workspace_id', value: ws },
            { name: 'delivery_id', value: delivery.id },
          ],
        },
      },
      svixId: 'evt_open',
    })!;
    const openResult = await applyProviderEvent(open);
    expect(openResult.reason).toBe('tracking_disabled');
  });

  it('reconcile reports missing provider ids without inventing opens', async () => {
    const { createLead } = await import('./leads.js');
    const { createSequence, enrollLead, processEnrollmentDueStep, markDeliveryStatus } = await import('./sequence-engine.js');
    const { runDeliveryReconciliation } = await import('./provider-events/reconcile.js');

    const ws = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const { lead } = createLead({
      workspaceId: ws,
      name: 'Bob',
      email: 'bob@example.com',
      source: 'manual',
    });
    const sequence = createSequence({
      workspaceId: ws,
      name: 'Cold',
      steps: [{ subject: 'Hi', body: 'Hello', delayHours: 0 }],
    });
    const enrollment = enrollLead({
      workspaceId: ws,
      leadId: lead.id,
      sequenceId: sequence.id,
      startAt: new Date('2020-01-01T12:00:00.000Z'),
    });
    const outcome = processEnrollmentDueStep(ws, enrollment.id, new Date('2020-01-01T12:00:00.000Z'));
    expect(outcome.kind).toBe('processed');
    if (outcome.kind !== 'processed') throw new Error('expected processed');
    markDeliveryStatus(ws, outcome.delivery.id, 'sent', { force: true });

    const summary = await runDeliveryReconciliation(new Date('2020-01-02T12:00:00.000Z'));
    expect(summary.missingProviderIds).toBeGreaterThanOrEqual(1);
    expect(summary.scanned).toBeGreaterThanOrEqual(1);
  });
});

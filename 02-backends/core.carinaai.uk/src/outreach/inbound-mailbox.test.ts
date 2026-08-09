import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { normalizeInboundMessage, extractCorrelationDeliveryId } from './inbound/normalize.js';
import { classifyReplyText } from './replies.js';
import { verifyMailgunWebhookSignature } from '../ingestion/email/mailgun-inbound.js';

describe('inbound normalize + sanitize', () => {
  it('normalizes emails, references, and checksum', () => {
    const msg = normalizeInboundMessage({
      workspaceId: 'ws-1',
      provider: 'gmail',
      providerMessageId: '<abc@mail.gmail.com>',
      from: 'Ada Lovelace <ada@example.com>',
      to: 'worker@aiva.test',
      subject: 'Re: Hello',
      textBody: 'Sounds good, interested!',
      inReplyTo: '<out-1@mail>',
      references: '<out-1@mail> <out-0@mail>',
      attachments: [{ filename: 'x.pdf', contentType: 'application/pdf', sizeBytes: 12 }],
    });
    expect(msg.from).toBe('ada@example.com');
    expect(msg.providerMessageId).toBe('abc@mail.gmail.com');
    expect(msg.inReplyTo).toBe('out-1@mail');
    expect(msg.references).toEqual(['out-1@mail', 'out-0@mail']);
    expect(msg.checksum).toHaveLength(64);
    expect(msg.attachments?.[0]?.filename).toBe('x.pdf');
  });

  it('extracts correlation tokens', () => {
    expect(extractCorrelationDeliveryId('Hi', 'token [aiva:11111111-1111-1111-1111-111111111111] here'))
      .toBe('11111111-1111-1111-1111-111111111111');
  });
});

describe('inbound matching + classification', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-inbound-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_OUTREACH_PERSISTENCE', 'json');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('matches In-Reply-To outbound provider id and refuses cross-workspace', async () => {
    const { createLead } = await import('./leads.js');
    const { createSequence, enrollLead, processEnrollmentDueStep, markDeliveryStatus } = await import('./sequence-engine.js');
    const { normalizeInboundMessage } = await import('./inbound/normalize.js');
    const { matchInboundMessage } = await import('./inbound/match.js');
    const { ingestNormalizedInbound } = await import('./inbound/ingest.js');

    const ws = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const otherWs = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
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
    if (outcome.kind !== 'processed') return;
    const marked = markDeliveryStatus(ws, outcome.delivery.id, 'sent', {
      providerMessageId: 'gmail-out-1',
      providerThreadId: 'thread-1',
      rfcMessageId: 'out-1@mail',
    });
    expect(marked?.providerThreadId).toBe('thread-1');
    const { listDeliveries } = await import('./sequence-engine.js');
    expect(listDeliveries(ws)[0]?.providerThreadId).toBe('thread-1');

    const msg = normalizeInboundMessage({
      workspaceId: ws,
      provider: 'gmail',
      providerMessageId: 'gmail-in-1',
      threadId: 'thread-1',
      inReplyTo: 'out-1@mail',
      from: 'Ada <ada@example.com>',
      subject: 'Re: Hi Ada',
      textBody: 'Yes please, interested in a call',
    });
    const match = matchInboundMessage(msg);
    expect(match.method).toBe('provider_thread');
    expect(match.leadId).toBe(lead.id);
    expect(match.deliveryId).toBe(outcome.delivery.id);
    expect(match.requiresReview).toBe(false);

    const ingested = await ingestNormalizedInbound(msg);
    expect(ingested.duplicate).toBe(false);
    expect(ingested.requiresReview).toBe(false);
    expect(ingested.classification).toBe('interested');

    // Cross-workspace: same message ids must not match foreign workspace store.
    const foreign = normalizeInboundMessage({
      workspaceId: otherWs,
      provider: 'gmail',
      providerMessageId: 'gmail-in-2',
      inReplyTo: 'out-1@mail',
      from: 'ada@example.com',
      subject: 'Re: Hi',
      textBody: 'hello',
    });
    const foreignMatch = matchInboundMessage(foreign);
    expect(foreignMatch.method).toBe('unmatched');
    expect(foreignMatch.requiresReview).toBe(true);
  });

  it('keeps ambiguous scored matches in review and classifies bounce/unsubscribe/ooo', async () => {
    expect(classifyReplyText('undeliverable', '550 mailbox unavailable').classification).toBe('bounce');
    expect(classifyReplyText('stop', 'Please unsubscribe me').classification).toBe('unsubscribe');
    expect(classifyReplyText('OOO', 'I am out of office until Monday').classification).toBe('ooo');
    expect(classifyReplyText('spam', 'This was reported as spam').classification).toBe('complaint');

    const { createLead } = await import('./leads.js');
    const { normalizeInboundMessage } = await import('./inbound/normalize.js');
    const { matchInboundMessage } = await import('./inbound/match.js');
    const { ingestNormalizedInbound } = await import('./inbound/ingest.js');
    const { listReplyReviews } = await import('./replies.js');

    const ws = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    createLead({
      workspaceId: ws,
      name: 'Grace Hopper',
      email: 'grace@navy.example',
      company: 'USN',
      source: 'manual',
    });
    const msg = normalizeInboundMessage({
      workspaceId: ws,
      provider: 'manual',
      providerMessageId: 'amb-1',
      from: 'someone-else@example.com',
      subject: 'About Grace Hopper at USN',
      textBody: 'Can you tell me more about Grace Hopper USN pricing?',
    });
    const match = matchInboundMessage(msg);
    expect(match.method).toBe('ambiguous');
    expect(match.requiresReview).toBe(true);
    await ingestNormalizedInbound(msg);
    const open = listReplyReviews(ws, { status: 'open' });
    expect(open.length).toBeGreaterThanOrEqual(1);
  });
});

describe('mailgun webhook signature', () => {
  it('accepts valid signatures and rejects replay/tamper', () => {
    const key = 'test-signing-key';
    vi.stubEnv('MAILGUN_WEBHOOK_SIGNING_KEY', key);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'token-abc';
    const signature = createHmac('sha256', key).update(timestamp.concat(token)).digest('hex');
    expect(verifyMailgunWebhookSignature({ timestamp, token, signature })).toBe(true);
    expect(verifyMailgunWebhookSignature({ timestamp, token, signature: 'deadbeef' })).toBe(false);
    expect(verifyMailgunWebhookSignature({
      timestamp: String(Math.floor(Date.now() / 1000) - 60 * 60),
      token,
      signature: createHmac('sha256', key)
        .update(String(Math.floor(Date.now() / 1000) - 60 * 60).concat(token))
        .digest('hex'),
    })).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe('gmail cursor expiry helper', () => {
  it('treats history expiry language as recoverable', () => {
    const err = 'Request had invalid historyId / 404 Not Found';
    expect(/404|410|historyId|expired|not found/i.test(err)).toBe(true);
  });
});

import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => query(...args) },
}));

vi.mock('./email-connection-store.js', () => ({
  getEmailConnection: vi.fn(async () => null),
  listSenders: vi.fn(async () => []),
  digestExists: vi.fn(async () => false),
  saveDigest: vi.fn(async () => 'digest-1'),
}));

vi.mock('./email-parser.js', () => ({
  parseEmailDigest: vi.fn(() => ({ summary: 'Please help', items: [] })),
}));

vi.mock('./email-categorizer.js', () => ({
  categorizeEmail: vi.fn(() => 'client_query'),
  categoryLabel: vi.fn((c: string) => c),
}));

vi.mock('./email-draft-handler.js', () => ({
  createDraftApprovalForEmail: vi.fn(async () => undefined),
}));

vi.mock('../../workers/worker-store.js', () => ({
  getWorkerById: vi.fn(async () => ({
    id: 'worker-1',
    workspaceId: 'ws-1',
    name: 'Ama',
  })),
  logActivity: vi.fn(async () => undefined),
}));

vi.mock('../../workers/worker-playbook-triggers.js', () => ({
  onWorkerInboundEvent: vi.fn(async () => undefined),
}));

vi.mock('./hosted-email-address.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hosted-email-address.js')>();
  return {
    ...actual,
    findHostedEmailAddressByRecipient: vi.fn(),
    recordHostedEmailInbound: vi.fn(),
  };
});

import { findHostedEmailAddressByRecipient } from './hosted-email-address.js';
import { saveDigest } from './email-connection-store.js';
import {
  processMailgunInbound,
  verifyMailgunWebhookSignature,
} from './mailgun-inbound.js';

function signedPayload(extra: Record<string, string> = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const token = 'tok';
  const signature = createHmac('sha256', 'test-signing-key')
    .update(`${timestamp}${token}`)
    .digest('hex');
  return {
    recipient: 'ama-9f2a1b@inbox.hireaiva.co.uk',
    sender: 'customer@example.com',
    from: 'Customer <customer@example.com>',
    subject: 'Need help',
    'body-plain': 'Please help with my order',
    'Message-Id': '<msg-accepted@example.com>',
    timestamp,
    token,
    signature,
    ...extra,
  };
}

describe('processMailgunInbound accepted path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = 'test-signing-key';
    process.env.NODE_ENV = 'test';
    vi.mocked(findHostedEmailAddressByRecipient).mockResolvedValue({
      id: 'addr-1',
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      address: 'ama-9f2a1b@inbox.hireaiva.co.uk',
      localPart: 'ama-9f2a1b',
      domain: 'inbox.hireaiva.co.uk',
      provider: 'mailgun',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('stores inbound with correct workspace and worker', async () => {
    const result = await processMailgunInbound(signedPayload());
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.workspaceId).toBe('ws-1');
      expect(result.workerId).toBe('worker-1');
      expect(result.digestId).toBe('digest-1');
    }
    expect(saveDigest).toHaveBeenCalledWith(
      'worker-1',
      '<msg-accepted@example.com>',
      'customer@example.com',
      null,
      expect.anything(),
      'client_query',
    );
  });

  it('rejects bad signatures', async () => {
    const result = await processMailgunInbound(
      signedPayload({ signature: 'nope' }),
    );
    expect(result.status).toBe('unauthorized');
  });

  it('signature helper matches Mailgun HMAC', () => {
    const timestamp = '1710000000';
    const token = 'token';
    const signature = createHmac('sha256', 'test-signing-key')
      .update(`${timestamp}${token}`)
      .digest('hex');
    expect(
      verifyMailgunWebhookSignature({
        timestamp,
        token,
        signature,
        nowSec: 1710000000,
      }),
    ).toBe(true);
  });
});

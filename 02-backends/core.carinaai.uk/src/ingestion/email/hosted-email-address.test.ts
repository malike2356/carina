import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => query(...args) },
}));

import {
  buildHostedLocalPart,
  ensureHostedEmailAddressForWorker,
  findHostedEmailAddressByRecipient,
  normalizeEmailRecipient,
  slugifyWorkerName,
} from './hosted-email-address.js';
import {
  parseMailgunInboundPayload,
  processMailgunInbound,
  verifyMailgunWebhookSignature,
} from './mailgun-inbound.js';

describe('hosted-email-address helpers', () => {
  beforeEach(() => {
    query.mockReset();
    process.env.AIVA_HOSTED_EMAIL_ENABLED = 'true';
    process.env.AIVA_HOSTED_EMAIL_DOMAIN = 'inbox.hireaiva.co.uk';
    delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  });

  it('slugifies worker names and builds local parts', () => {
    expect(slugifyWorkerName('Ama Support!')).toBe('ama-support');
    expect(buildHostedLocalPart('Ama', '9f2a1b00-0000-4000-8000-000000000000')).toBe(
      'ama-9f2a1b',
    );
    expect(
      buildHostedLocalPart('Ama', '9f2a1b00-0000-4000-8000-000000000000', 'ab12'),
    ).toBe('ama-9f2a1b-ab12');
  });

  it('normalizes recipients case-insensitively and from display names', () => {
    expect(normalizeEmailRecipient('Ama <AMA-9F2A1B@Inbox.HireAiva.co.uk>')).toBe(
      'ama-9f2a1b@inbox.hireaiva.co.uk',
    );
    expect(normalizeEmailRecipient('ama-9f2a1b@inbox.hireaiva.co.uk')).toBe(
      'ama-9f2a1b@inbox.hireaiva.co.uk',
    );
  });

  it('returns existing address for a worker without creating another', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // ensureSchema
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'addr-1',
            workspace_id: 'ws-1',
            worker_id: 'worker-1',
            address: 'ama-9f2a1b@inbox.hireaiva.co.uk',
            local_part: 'ama-9f2a1b',
            domain: 'inbox.hireaiva.co.uk',
            provider: 'mailgun',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });

    const first = await ensureHostedEmailAddressForWorker({
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      workerName: 'Ama',
    });
    expect(first?.address).toBe('ama-9f2a1b@inbox.hireaiva.co.uk');

    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'addr-1',
          workspace_id: 'ws-1',
          worker_id: 'worker-1',
          address: 'ama-9f2a1b@inbox.hireaiva.co.uk',
          local_part: 'ama-9f2a1b',
          domain: 'inbox.hireaiva.co.uk',
          provider: 'mailgun',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const second = await ensureHostedEmailAddressForWorker({
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      workerName: 'Ama',
    });
    expect(second?.address).toBe(first?.address);
  });

  it('retries on local_part collision', async () => {
    const conflict = Object.assign(new Error('duplicate'), { code: '23505' });
    let insertAttempts = 0;
    query.mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('CREATE TABLE')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('WHERE worker_id = $1')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO aiva_hosted_email_addresses')) {
        insertAttempts += 1;
        if (insertAttempts === 1) throw conflict;
        return {
          rows: [
            {
              id: 'addr-2',
              workspace_id: 'ws-1',
              worker_id: 'worker-2',
              address: 'ama-abcdef-ab12@inbox.hireaiva.co.uk',
              local_part: 'ama-abcdef-ab12',
              domain: 'inbox.hireaiva.co.uk',
              provider: 'mailgun',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    const result = await ensureHostedEmailAddressForWorker({
      workspaceId: 'ws-1',
      workerId: 'worker-2',
      workerName: 'Ama',
    });
    expect(insertAttempts).toBeGreaterThanOrEqual(2);
    expect(result?.workerId).toBe('worker-2');
    expect(result?.address).toContain('@inbox.hireaiva.co.uk');
  });

  it('looks up recipients case-insensitively and rejects inactive', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'addr-1',
          workspace_id: 'ws-1',
          worker_id: 'worker-1',
          address: 'ama-9f2a1b@inbox.hireaiva.co.uk',
          local_part: 'ama-9f2a1b',
          domain: 'inbox.hireaiva.co.uk',
          provider: 'mailgun',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const found = await findHostedEmailAddressByRecipient(
      'Ama <AMA-9F2A1B@Inbox.HireAiva.co.uk>',
    );
    expect(found?.workerId).toBe('worker-1');

    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'addr-1',
          workspace_id: 'ws-1',
          worker_id: 'worker-1',
          address: 'ama-9f2a1b@inbox.hireaiva.co.uk',
          local_part: 'ama-9f2a1b',
          domain: 'inbox.hireaiva.co.uk',
          provider: 'mailgun',
          status: 'disabled',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const inactive = await findHostedEmailAddressByRecipient(
      'ama-9f2a1b@inbox.hireaiva.co.uk',
    );
    expect(inactive).toBeNull();
  });
});

describe('mailgun signature and inbound', () => {
  beforeEach(() => {
    query.mockReset();
    process.env.AIVA_HOSTED_EMAIL_ENABLED = 'true';
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = 'test-signing-key';
    process.env.NODE_ENV = 'test';
  });

  it('accepts valid signatures and rejects invalid ones', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = 'abc123token';
    const signature = createHmac('sha256', 'test-signing-key')
      .update(`${timestamp}${token}`)
      .digest('hex');

    expect(
      verifyMailgunWebhookSignature({ timestamp, token, signature }),
    ).toBe(true);
    expect(
      verifyMailgunWebhookSignature({
        timestamp,
        token,
        signature: 'deadbeef',
      }),
    ).toBe(false);
  });

  it('parses mailgun fields', () => {
    const parsed = parseMailgunInboundPayload({
      recipient: 'ama-9f2a1b@inbox.hireaiva.co.uk',
      sender: 'customer@example.com',
      from: 'Customer <customer@example.com>',
      subject: 'Hello',
      'body-plain': 'Please help',
      'Message-Id': '<msg-1@example.com>',
      timestamp: '1710000000',
      token: 'tok',
      signature: 'sig',
      'attachment-count': '1',
    });
    expect(parsed.recipient).toBe('ama-9f2a1b@inbox.hireaiva.co.uk');
    expect(parsed.bodyPlain).toBe('Please help');
    expect(parsed.attachmentCount).toBe(1);
  });

  it('ignores unknown recipients without crashing', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // ensureSchema / lookup
      .mockResolvedValueOnce({ rows: [] });

    const result = await processMailgunInbound({
      recipient: 'nobody-zzzzzz@inbox.hireaiva.co.uk',
      sender: 'x@example.com',
      from: 'x@example.com',
      subject: 'Hi',
      'body-plain': 'Hello',
      timestamp: String(Math.floor(Date.now() / 1000)),
      token: 'tok',
      signature: createHmac('sha256', 'test-signing-key')
        .update(`${Math.floor(Date.now() / 1000)}tok`)
        .digest('hex'),
    });

    expect(result.status).toBe('ignored');
    if (result.status === 'ignored') {
      expect(result.reason).toBe('unknown_recipient');
    }
  });

  it('rejects invalid signatures when required', async () => {
    const result = await processMailgunInbound({
      recipient: 'ama-9f2a1b@inbox.hireaiva.co.uk',
      sender: 'x@example.com',
      from: 'x@example.com',
      subject: 'Hi',
      'body-plain': 'Hello',
      timestamp: String(Math.floor(Date.now() / 1000)),
      token: 'tok',
      signature: 'invalid',
    });
    expect(result.status).toBe('unauthorized');
  });
});

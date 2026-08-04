import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AivaApiError } from './aiva-client';
import {
  applyOptimisticRemove,
  createApprovalSubmitGuard,
  decideApproval,
  formatApprovalAge,
  mapApprovalToInboxRow,
  mergeApprovalInboxes,
  parseEmailApprovalsInbox,
  parseSocialApprovalsInbox,
  rollbackApprovalList,
} from './aiva-approvals';

describe('inbox list mapping', () => {
  it('parses email and social envelopes into sorted inbox rows', () => {
    const email = parseEmailApprovalsInbox({
      approvals: [
        {
          id: 'e1',
          workerId: 'w1',
          category: 'client_query',
          recipient: 'a@example.com',
          subject: 'Quote follow-up',
          draftBody: 'Thanks for your message...',
          requestedAt: '2026-07-11T10:00:00.000Z',
          timeoutAt: '2026-07-12T10:00:00.000Z',
        },
      ],
    }, new Map([['w1', 'Front desk']]));

    const social = parseSocialApprovalsInbox({
      approvals: [
        {
          id: 's1',
          workerId: 'w2',
          workerName: 'Social lead',
          channel: 'linkedin',
          contactId: 'abcd1234efgh',
          draftText: 'Happy to connect',
          inboundText: 'Can we chat?',
          requestedAt: '2026-07-11T11:00:00.000Z',
          timeoutAt: '2026-07-12T11:00:00.000Z',
        },
      ],
    });

    const merged = mergeApprovalInboxes(email, social);
    expect(merged[0]?.id).toBe('s1');
    const row = mapApprovalToInboxRow(merged[1]!);
    expect(row).toMatchObject({
      kind: 'email',
      typeLabel: 'Email',
      title: 'Quote follow-up',
      workerName: 'Front desk',
    });
    expect(formatApprovalAge('2026-07-11T10:00:00.000Z', Date.parse('2026-07-11T10:05:00.000Z'))).toBe(
      '5m ago',
    );
  });
});

describe('double-submit guard', () => {
  it('blocks a second begin until end', () => {
    const guard = createApprovalSubmitGuard();
    expect(guard.tryBegin('e1')).toBe(true);
    expect(guard.tryBegin('e1')).toBe(false);
    guard.end('e1');
    expect(guard.tryBegin('e1')).toBe(true);
  });
});

describe('optimistic list + rollback', () => {
  it('removes then restores on failure path', () => {
    const items = parseEmailApprovalsInbox({
      approvals: [
        {
          id: 'e1',
          workerId: 'w1',
          category: 'x',
          recipient: 'a@x.com',
          subject: 'Hi',
          draftBody: 'Body',
          requestedAt: '2026-07-11T10:00:00.000Z',
          timeoutAt: '2026-07-12T10:00:00.000Z',
        },
      ],
    });
    const previous = items;
    const next = applyOptimisticRemove(items, 'e1');
    expect(next).toHaveLength(0);
    expect(rollbackApprovalList(next, previous)).toEqual(previous);
  });
});

describe('approve/reject wrappers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts approve for email and reject for social', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    await decideApproval(
      'https://app.carinaai.uk',
      { id: 'e1', kind: 'email' },
      'approve',
      { apiKey: 't' },
    );
    await decideApproval(
      'https://app.carinaai.uk',
      { id: 's1', kind: 'social' },
      'reject',
      { apiKey: 't' },
    );

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'https://app.carinaai.uk/api/aiva/email/approvals/e1/approve',
    );
    expect(fetchSpy.mock.calls[1]?.[0]).toBe(
      'https://app.carinaai.uk/api/aiva/social/approvals/s1/reject',
    );
  });

  it('surfaces error envelopes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Approval not found or already resolved' }), {
        status: 404,
        statusText: 'Not Found',
      }),
    );

    try {
      await decideApproval(
        'https://app.carinaai.uk',
        { id: 'e1', kind: 'email' },
        'approve',
        { apiKey: 't' },
      );
      throw new Error('expected reject');
    } catch (err) {
      expect(err).toBeInstanceOf(AivaApiError);
      expect((err as AivaApiError).message).toMatch(/already resolved|404/);
    }
  });
});

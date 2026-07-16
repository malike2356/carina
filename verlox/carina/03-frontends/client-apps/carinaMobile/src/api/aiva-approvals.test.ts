import { describe, expect, it } from 'vitest';
import {
  createApprovalSubmitGuard,
  formatApprovalAge,
  mergeApprovalInboxes,
  parseEmailApprovalsInbox,
  parseSocialApprovalsInbox,
} from './aiva-approvals';

describe('aiva approvals helpers', () => {
  it('parses and orders mixed approval inboxes newest first', () => {
    const workers = new Map([['worker-1', 'Ava']]);
    const email = parseEmailApprovalsInbox({
      approvals: [{
        id: 'email-1',
        workerId: 'worker-1',
        subject: 'Reply',
        requestedAt: '2026-07-16T10:00:00.000Z',
      }],
    }, workers);
    const social = parseSocialApprovalsInbox({
      approvals: [{
        id: 'social-1',
        workerId: 'worker-2',
        draftText: 'Thanks',
        requestedAt: '2026-07-16T11:00:00.000Z',
      }],
    });

    expect(email[0]?.workerName).toBe('Ava');
    expect(mergeApprovalInboxes(email, social).map((item) => item.id)).toEqual([
      'social-1',
      'email-1',
    ]);
  });

  it('formats age labels and prevents duplicate submissions', () => {
    const now = Date.parse('2026-07-16T12:00:00.000Z');
    expect(formatApprovalAge('2026-07-16T11:55:00.000Z', now)).toBe('5m ago');

    const guard = createApprovalSubmitGuard();
    expect(guard.tryBegin('email:1')).toBe(true);
    expect(guard.tryBegin('email:1')).toBe(false);
    guard.end('email:1');
    expect(guard.tryBegin('email:1')).toBe(true);
  });
});

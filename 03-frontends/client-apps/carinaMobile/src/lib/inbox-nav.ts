export type InboxSegment = 'approvals' | 'conversations' | 'escalations';

export const INBOX_SEGMENTS: { id: InboxSegment; label: string }[] = [
  { id: 'approvals', label: 'Approvals' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'escalations', label: 'Escalations' },
];

export function parseInboxSegment(value: unknown): InboxSegment {
  if (value === 'conversations' || value === 'escalations' || value === 'approvals') {
    return value;
  }
  return 'approvals';
}

export function inboxSegmentSubtitle(segment: InboxSegment): string {
  switch (segment) {
    case 'conversations':
      return 'Recent threads across employees (read-only).';
    case 'escalations':
      return 'Open handoffs waiting for a human.';
    case 'approvals':
    default:
      return 'Drafts waiting for your approval.';
  }
}

export function isInboxSegment(value: string): value is InboxSegment {
  return value === 'approvals' || value === 'conversations' || value === 'escalations';
}

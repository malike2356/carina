export type CommitmentStatus = 'pending' | 'sent' | 'dismissed' | 'snoozed' | 'expired';

export type CommitmentKind = 'check_in' | 'follow_up' | 'care' | 'deadline_adjacent';

export interface Commitment {
  id: string;
  status: CommitmentStatus;
  kind: CommitmentKind;
  agentId: string;
  sessionId: string;
  channel: string | null;
  conversationId: string | null;
  threadId: string | null;
  dueAt: string;
  dueLatestAt: string;
  checkInText: string;
  sourceSummary: string;
  confidence: number;
  createdAt: string;
  sentAt?: string;
  dismissedAt?: string;
  snoozedUntil?: string;
}

export interface CommitmentStore {
  version: number;
  commitments: Commitment[];
}

export interface TurnExchange {
  userMessage: string;
  assistantText: string;
}

export interface ExtractedCommitment {
  kind: CommitmentKind;
  confidence: number;
  dueInHours: number;
  dueInHoursLatest: number;
  checkInText: string;
  sourceSummary: string;
}

export interface CommitmentInferenceContext {
  sessionId: string;
  agentId: string;
  platform?: string;
  userMessage: string;
  assistantText: string;
  channel?: string | null;
  conversationId?: string | null;
  threadId?: string | null;
}

export interface ListCommitmentsFilter {
  status?: CommitmentStatus | 'all';
  agentId?: string;
  sessionId?: string;
}

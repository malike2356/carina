export type KanbanColumn = 'backlog' | 'in_progress' | 'review' | 'done' | 'blocked';

export type KanbanActorRole = 'orchestrator' | 'worker';

export type KanbanTargetRole = 'orchestrator' | 'worker' | 'any';

export const KANBAN_COLUMNS: KanbanColumn[] = [
  'backlog',
  'in_progress',
  'review',
  'done',
  'blocked',
];

export const COLUMN_TRANSITIONS: Record<KanbanColumn, KanbanColumn[]> = {
  backlog: ['in_progress', 'blocked'],
  in_progress: ['review', 'backlog', 'blocked'],
  review: ['done', 'in_progress', 'backlog'],
  done: [],
  blocked: ['backlog'],
};

export interface KanbanCard {
  id: string;
  sessionId: string;
  boardId: string;
  title: string;
  description: string | null;
  column: KanbanColumn;
  assignee: string | null;
  priority: number;
  blocked: boolean;
  blockReason: string | null;
  linkedCardId: string | null;
  sortOrder: number;
  version: number;
  workPrompt: string | null;
  resultSummary: string | null;
  orchestratorNotes: string | null;
  targetRole: KanbanTargetRole;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KanbanComment {
  id: string;
  cardId: string;
  author: string;
  body: string;
  createdAt: Date;
}

export class KanbanWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_transition' | 'permission_denied' | 'not_claimable' | 'conflict' | 'not_found',
  ) {
    super(message);
    this.name = 'KanbanWorkflowError';
  }
}

import type { KanbanActorRole, KanbanCard, KanbanColumn } from './kanban-types.js';
import { COLUMN_TRANSITIONS, KanbanWorkflowError } from './kanban-types.js';

export function resolveDisplayColumn(card: KanbanCard): KanbanColumn {
  if (card.blocked) return 'blocked';
  return card.column;
}

export function canTransition(from: KanbanColumn, to: KanbanColumn): boolean {
  if (from === to) return true;
  if (to === 'blocked' || from === 'blocked') return true;
  return COLUMN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  card: KanbanCard,
  toColumn: KanbanColumn,
  role: KanbanActorRole,
): void {
  const from = resolveDisplayColumn(card);
  if (from === toColumn) return;

  if (!canTransition(from, toColumn)) {
    throw new KanbanWorkflowError(
      `Cannot move from ${from} to ${toColumn}`,
      'invalid_transition',
    );
  }

  if (role === 'worker') {
    const allowed: KanbanColumn[] = ['in_progress', 'review', 'backlog'];
    if (!allowed.includes(toColumn) && toColumn !== 'blocked') {
      throw new KanbanWorkflowError('Workers cannot move cards to that column', 'permission_denied');
    }
    if (card.assignee && toColumn === 'review' && from === 'in_progress') {
      return;
    }
    if (toColumn === 'done') {
      throw new KanbanWorkflowError('Workers cannot close cards; move to review', 'permission_denied');
    }
  }
}

export function isCardClaimable(card: KanbanCard): boolean {
  if (card.blocked || card.column === 'done' || card.closedAt) return false;
  if (card.column === 'backlog' || card.column === 'review') return !card.assignee;
  if (card.column === 'in_progress' && !card.assignee) return true;
  return false;
}

export function assertClaimable(card: KanbanCard, assignee: string): void {
  if (!isCardClaimable(card)) {
    throw new KanbanWorkflowError(
      `Card not claimable (column=${card.column}, assignee=${card.assignee ?? 'none'})`,
      'not_claimable',
    );
  }
  if (card.assignee && card.assignee !== assignee) {
    throw new KanbanWorkflowError(`Already assigned to ${card.assignee}`, 'not_claimable');
  }
}

export function assertRelease(card: KanbanCard, assignee: string): void {
  if (card.assignee && card.assignee !== assignee) {
    throw new KanbanWorkflowError(`Assigned to ${card.assignee}, not ${assignee}`, 'permission_denied');
  }
}

export function cardToPayload(card: KanbanCard): Record<string, unknown> {
  return {
    card_id: card.id,
    title: card.title,
    column: resolveDisplayColumn(card),
    description: card.description,
    assignee: card.assignee,
    priority: card.priority,
    blocked: card.blocked,
    block_reason: card.blockReason,
    linked_card_id: card.linkedCardId,
    sort_order: card.sortOrder,
    version: card.version,
    work_prompt: card.workPrompt,
    result_summary: card.resultSummary,
    orchestrator_notes: card.orchestratorNotes,
    target_role: card.targetRole,
    closed_at: card.closedAt?.toISOString() ?? null,
    updated_at: card.updatedAt.toISOString(),
  };
}

import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  isCardClaimable,
} from './kanban-workflow.js';
import type { KanbanCard } from './kanban-types.js';
import { KanbanWorkflowError } from './kanban-types.js';

function baseCard(overrides: Partial<KanbanCard> = {}): KanbanCard {
  return {
    id: 'c1',
    sessionId: 'op:default',
    boardId: 'default',
    title: 'Task',
    description: null,
    column: 'backlog',
    assignee: null,
    priority: 0,
    blocked: false,
    blockReason: null,
    linkedCardId: null,
    sortOrder: 0,
    version: 1,
    workPrompt: null,
    resultSummary: null,
    orchestratorNotes: null,
    targetRole: 'any',
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('kanban-workflow', () => {
  it('allows valid column transitions', () => {
    expect(canTransition('backlog', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'review')).toBe(true);
    expect(canTransition('done', 'backlog')).toBe(false);
  });

  it('denies worker closing cards', () => {
    const card = baseCard({ column: 'review' });
    expect(() => assertTransition(card, 'done', 'worker')).toThrow(KanbanWorkflowError);
  });

  it('allows orchestrator to close from review', () => {
    const card = baseCard({ column: 'review' });
    expect(() => assertTransition(card, 'done', 'orchestrator')).not.toThrow();
  });

  it('blocks claim on done cards', () => {
    expect(isCardClaimable(baseCard({ column: 'done' }))).toBe(false);
  });
});

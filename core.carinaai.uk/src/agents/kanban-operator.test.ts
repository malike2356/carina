import { describe, expect, it } from 'vitest';
import { isCardClaimable, type KanbanCard } from './kanban-store.js';
import { operatorSessionId } from '../ops/operator-profile.js';

function card(partial: Partial<KanbanCard>): KanbanCard {
  return {
    id: 'id-1',
    sessionId: 'op:work',
    boardId: 'default',
    title: 'Task',
    description: null,
    column: 'backlog',
    assignee: null,
    priority: 0,
    blocked: false,
    blockReason: null,
    linkedCardId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe('kanban operator', () => {
  it('scopes session ids per profile', () => {
    expect(operatorSessionId('work')).toBe('op:work');
    expect(operatorSessionId('home')).toBe('op:home');
  });

  it('allows claim on backlog and review', () => {
    expect(isCardClaimable(card({ column: 'backlog' }))).toBe(true);
    expect(isCardClaimable(card({ column: 'review' }))).toBe(true);
  });

  it('blocks claim on done and blocked cards', () => {
    expect(isCardClaimable(card({ column: 'done' }))).toBe(false);
    expect(isCardClaimable(card({ blocked: true, column: 'backlog' }))).toBe(false);
  });
});

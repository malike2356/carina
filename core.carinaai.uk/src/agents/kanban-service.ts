import type { KanbanActorRole, KanbanCard, KanbanColumn } from './kanban-types.js';
import { KanbanWorkflowError } from './kanban-types.js';
import {
  addCard,
  addComment,
  blockCard,
  claimCard,
  closeCard,
  getCard,
  listCards,
  listComments,
  moveCard,
  releaseCard,
  showBoard,
  updateCard,
} from './kanban-store.js';
import {
  assertClaimable,
  assertRelease,
  assertTransition,
  cardToPayload,
  isCardClaimable,
  resolveDisplayColumn,
} from './kanban-workflow.js';
import { GenericSubAgent } from './generic-sub-agent.js';
import {
  canDelegate,
  createChildAbortController,
  getDelegationDepth,
  releaseChildAbortController,
  setDelegationDepth,
  clearDelegationDepth,
} from './delegation-context.js';
import { resolveToolset } from '../tools/toolset.js';

export async function getBoardView(sessionId: string, boardId = 'default') {
  const grouped = await showBoard(sessionId, boardId);
  return {
    board_id: boardId,
    session_id: sessionId,
    columns: Object.fromEntries(
      Object.entries(grouped).map(([col, cards]) => [col, cards.map(cardToPayload)]),
    ),
  };
}

export async function createBoardCard(
  role: KanbanActorRole,
  input: {
    sessionId: string;
    boardId?: string;
    title: string;
    description?: string;
    column?: KanbanColumn;
    priority?: number;
    workPrompt?: string;
    orchestratorNotes?: string;
    targetRole?: 'orchestrator' | 'worker' | 'any';
  },
) {
  if (role !== 'orchestrator') {
    throw new KanbanWorkflowError('Only orchestrators can create cards', 'permission_denied');
  }
  const card = await addCard(input);
  return cardToPayload(card);
}

export async function transitionCard(
  role: KanbanActorRole,
  cardId: string,
  toColumn: KanbanColumn,
  opts?: { assignee?: string; expectedVersion?: number; actor?: string },
) {
  const existing = await getCard(cardId);
  if (!existing) throw new KanbanWorkflowError('Card not found', 'not_found');
  assertTransition(existing, toColumn, role);
  if (role === 'worker' && opts?.actor && existing.assignee && existing.assignee !== opts.actor) {
    throw new KanbanWorkflowError(`Assigned to ${existing.assignee}`, 'permission_denied');
  }
  const card = await moveCard(cardId, toColumn, opts?.assignee, opts?.expectedVersion);
  if (!card) throw new KanbanWorkflowError('Card not found', 'not_found');
  return cardToPayload(card);
}

export async function workerClaimCard(
  cardId: string,
  assignee: string,
  expectedVersion?: number,
) {
  const existing = await getCard(cardId);
  if (!existing) throw new KanbanWorkflowError('Card not found', 'not_found');
  assertClaimable(existing, assignee);
  const result = await claimCard(cardId, assignee, expectedVersion ?? existing.version);
  if (result.error || !result.card) {
    throw new KanbanWorkflowError(result.error ?? 'claim failed', 'not_claimable');
  }
  return cardToPayload(result.card);
}

export async function workerReleaseCard(
  cardId: string,
  assignee: string,
  expectedVersion?: number,
) {
  const existing = await getCard(cardId);
  if (!existing) throw new KanbanWorkflowError('Card not found', 'not_found');
  assertRelease(existing, assignee);
  const result = await releaseCard(cardId, assignee, expectedVersion ?? existing.version);
  if (result.error || !result.card) {
    throw new KanbanWorkflowError(result.error ?? 'release failed', 'permission_denied');
  }
  return cardToPayload(result.card);
}

export async function orchestratorCloseCard(cardId: string, expectedVersion?: number) {
  const existing = await getCard(cardId);
  if (!existing) throw new KanbanWorkflowError('Card not found', 'not_found');
  const card = await closeCard(cardId, expectedVersion ?? existing.version);
  if (!card) throw new KanbanWorkflowError('Card not found', 'not_found');
  return cardToPayload(card);
}

export async function patchCard(
  role: KanbanActorRole,
  cardId: string,
  patch: {
    expectedVersion?: number;
    title?: string;
    description?: string;
    priority?: number;
    workPrompt?: string;
    orchestratorNotes?: string;
    resultSummary?: string;
  },
) {
  if (role === 'worker' && (patch.title || patch.workPrompt || patch.orchestratorNotes)) {
    throw new KanbanWorkflowError('Workers cannot edit orchestrator fields', 'permission_denied');
  }
  const card = await updateCard({ cardId, ...patch });
  return cardToPayload(card);
}

export async function runCardWork(
  sessionId: string,
  cardId: string,
  toolsets?: string[],
): Promise<{ card: Record<string, unknown>; summary: string }> {
  const card = await getCard(cardId);
  if (!card) throw new KanbanWorkflowError('Card not found', 'not_found');
  if (card.sessionId !== sessionId) {
    throw new KanbanWorkflowError('Card not in this session scope', 'permission_denied');
  }
  if (!canDelegate(sessionId)) {
    throw new KanbanWorkflowError('Delegation depth limit reached', 'permission_denied');
  }

  await moveCard(cardId, 'in_progress', 'subagent', card.version);

  const allowedTools = resolveToolset(toolsets ?? ['terminal', 'file', 'web']);
  const childDepth = getDelegationDepth(sessionId) + 1;
  const childAbort = createChildAbortController(sessionId);
  const subSessionId = `${sessionId}:kanban:${cardId}`;

  try {
    setDelegationDepth(subSessionId, childDepth);
    const agent = new GenericSubAgent(
      subSessionId,
      card.title,
      allowedTools,
      undefined,
      undefined,
      childDepth,
      childAbort.signal,
    );
    const base = card.workPrompt ?? card.description ?? '';
    const prompt = base ? `${base}\n\nTask: ${card.title}` : card.title;
    const summary = await agent.run(prompt);
    const updated = await updateCard({
      cardId,
      resultSummary: summary.slice(0, 4000),
    });
    await moveCard(cardId, 'review', undefined, updated.version);
    const finalCard = await getCard(cardId);
    return { card: cardToPayload(finalCard!), summary };
  } catch (err) {
    const current = await getCard(cardId);
    if (current) await moveCard(cardId, 'backlog', undefined, current.version);
    throw err;
  } finally {
    releaseChildAbortController(sessionId, childAbort);
    clearDelegationDepth(subSessionId);
  }
}

export {
  addComment,
  blockCard,
  getCard,
  isCardClaimable,
  listCards,
  listComments,
  resolveDisplayColumn,
};

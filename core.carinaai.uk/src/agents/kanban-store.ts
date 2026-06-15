import { pool } from '../memory/db.js';
import { v4 as uuidv4 } from 'uuid';
import { dispatchWebhook } from '../webhooks/dispatcher.js';
import type { KanbanCard, KanbanColumn, KanbanComment, KanbanTargetRole } from './kanban-types.js';
import { KanbanWorkflowError } from './kanban-types.js';
import { resolveDisplayColumn } from './kanban-workflow.js';

export type { KanbanCard, KanbanColumn, KanbanComment, KanbanTargetRole } from './kanban-types.js';
export { KanbanWorkflowError } from './kanban-types.js';

function parseTargetRole(value: unknown): KanbanTargetRole {
  const role = String(value ?? 'any');
  if (role === 'orchestrator' || role === 'worker') return role;
  return 'any';
}

function rowToCard(row: Record<string, unknown>): KanbanCard {
  const col = String(row.column_name);
  const blocked = Boolean(row.blocked);
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    boardId: String(row.board_id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    column: (blocked ? 'blocked' : col) as KanbanColumn,
    assignee: row.assignee ? String(row.assignee) : null,
    priority: Number(row.priority ?? 0),
    blocked,
    blockReason: row.block_reason ? String(row.block_reason) : null,
    linkedCardId: row.linked_card_id ? String(row.linked_card_id) : null,
    sortOrder: Number(row.sort_order ?? 0),
    version: Number(row.version ?? 1),
    workPrompt: row.work_prompt ? String(row.work_prompt) : null,
    resultSummary: row.result_summary ? String(row.result_summary) : null,
    orchestratorNotes: row.orchestrator_notes ? String(row.orchestrator_notes) : null,
    targetRole: parseTargetRole(row.target_role),
    closedAt: row.closed_at ? new Date(String(row.closed_at)) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function emitMove(card: KanbanCard, extra: Record<string, unknown> = {}): void {
  const column = resolveDisplayColumn(card);
  const payload = {
    card_id: card.id,
    session_id: card.sessionId,
    board_id: card.boardId,
    column,
    title: card.title,
    assignee: card.assignee,
    blocked: card.blocked,
    version: card.version,
    ...extra,
  };
  void dispatchWebhook('kanban.move', payload);
  if (process.env.CARINA_TASKFLOWS_ENABLED !== 'false') {
    void import('../ops/taskflows/hooks.js').then(({ onKanbanEvent }) => {
      const event = column === 'review' ? 'review' : column === 'done' ? 'done' : 'move';
      onKanbanEvent(event, payload);
    });
  }
}

async function nextSortOrder(sessionId: string, boardId: string, column: string): Promise<number> {
  const result = await pool.query<{ max: string | null }>(
    `SELECT MAX(sort_order)::text AS max FROM kanban_cards
     WHERE session_id = $1 AND board_id = $2 AND column_name = $3`,
    [sessionId, boardId, column],
  );
  return Number(result.rows[0]?.max ?? -1) + 1;
}

export async function createCard(input: {
  sessionId: string;
  boardId?: string;
  title: string;
  description?: string;
  column?: KanbanColumn;
  priority?: number;
  workPrompt?: string;
  orchestratorNotes?: string;
  targetRole?: KanbanTargetRole;
}): Promise<KanbanCard> {
  return addCard(input);
}

export async function addCard(input: {
  sessionId: string;
  boardId?: string;
  title: string;
  description?: string;
  column?: KanbanColumn;
  priority?: number;
  workPrompt?: string;
  orchestratorNotes?: string;
  targetRole?: KanbanTargetRole;
}): Promise<KanbanCard> {
  const id = uuidv4();
  const boardId = input.boardId ?? 'default';
  const column = input.column === 'blocked' ? 'backlog' : (input.column ?? 'backlog');
  const blocked = input.column === 'blocked';
  const sortOrder = await nextSortOrder(input.sessionId, boardId, column);
  const result = await pool.query(
    `INSERT INTO kanban_cards
       (id, session_id, board_id, title, description, column_name, priority, blocked,
        work_prompt, orchestrator_notes, target_role, sort_order, version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1)
     RETURNING *`,
    [
      id,
      input.sessionId,
      boardId,
      input.title,
      input.description ?? null,
      column,
      input.priority ?? 0,
      blocked,
      input.workPrompt ?? null,
      input.orchestratorNotes ?? null,
      input.targetRole ?? 'any',
      sortOrder,
    ],
  );
  const card = rowToCard(result.rows[0]);
  emitMove(card, { action: 'create' });
  return card;
}

export async function listCards(
  sessionId: string,
  boardId = 'default',
  column?: KanbanColumn,
): Promise<KanbanCard[]> {
  const query = column
    ? `SELECT * FROM kanban_cards WHERE session_id = $1 AND board_id = $2 AND column_name = $3
       ORDER BY sort_order ASC, priority DESC, created_at ASC`
    : `SELECT * FROM kanban_cards WHERE session_id = $1 AND board_id = $2
       ORDER BY column_name, sort_order ASC, priority DESC, created_at ASC`;
  const params = column ? [sessionId, boardId, column === 'blocked' ? 'backlog' : column] : [sessionId, boardId];
  const result = await pool.query(query, params);
  const cards = result.rows.map(rowToCard);
  if (column === 'blocked') return cards.filter((c) => c.blocked);
  if (column) return cards.filter((c) => !c.blocked);
  return cards;
}

export async function showBoard(sessionId: string, boardId = 'default'): Promise<Record<KanbanColumn, KanbanCard[]>> {
  const cards = await listCards(sessionId, boardId);
  return groupByColumn(cards);
}

async function updateWithVersion(
  cardId: string,
  expectedVersion: number | undefined,
  setterSql: string,
  setterParams: unknown[],
): Promise<KanbanCard> {
  const existing = await getCard(cardId);
  if (!existing) {
    throw new KanbanWorkflowError('Card not found', 'not_found');
  }
  const version = expectedVersion ?? existing.version;
  if (version !== existing.version) {
    throw new KanbanWorkflowError('Card was modified by another session', 'conflict');
  }
  const versionIdx = setterParams.length + 1;
  const idIdx = setterParams.length + 2;
  const result = await pool.query(
    `UPDATE kanban_cards SET ${setterSql}, version = version + 1, updated_at = NOW()
     WHERE id = $${idIdx} AND version = $${versionIdx}
     RETURNING *`,
    [...setterParams, version, cardId],
  );
  if (!result.rows[0]) {
    throw new KanbanWorkflowError('Card was modified by another session', 'conflict');
  }
  return rowToCard(result.rows[0]);
}

export async function moveCard(
  cardId: string,
  column: KanbanColumn,
  assignee?: string,
  expectedVersion?: number,
): Promise<KanbanCard | null> {
  try {
    const existing = await getCard(cardId);
    if (!existing) return null;
    const blocked = column === 'blocked';
    const colName = blocked ? 'backlog' : column;
    const sortOrder = await nextSortOrder(existing.sessionId, existing.boardId, colName);
    const card = await updateWithVersion(
      cardId,
      expectedVersion,
      'column_name = $1, blocked = $2, assignee = COALESCE($3, assignee), sort_order = $4',
      [colName, blocked, assignee ?? null, sortOrder],
    );
    emitMove(card, { action: 'move' });
    return card;
  } catch (err) {
    if (err instanceof KanbanWorkflowError) throw err;
    return null;
  }
}

export async function updateCard(input: {
  cardId: string;
  expectedVersion?: number;
  title?: string;
  description?: string;
  priority?: number;
  workPrompt?: string;
  orchestratorNotes?: string;
  resultSummary?: string;
  targetRole?: KanbanTargetRole;
}): Promise<KanbanCard> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  const map: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    priority: input.priority,
    work_prompt: input.workPrompt,
    orchestrator_notes: input.orchestratorNotes,
    result_summary: input.resultSummary,
    target_role: input.targetRole,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      params.push(val);
    }
  }
  if (fields.length === 0) {
    const card = await getCard(input.cardId);
    if (!card) throw new KanbanWorkflowError('Card not found', 'not_found');
    return card;
  }
  const card = await updateWithVersion(
    input.cardId,
    input.expectedVersion,
    fields.join(', '),
    params,
  );
  emitMove(card, { action: 'update' });
  return card;
}

export async function completeCard(cardId: string, expectedVersion?: number): Promise<KanbanCard | null> {
  const card = await closeCard(cardId, expectedVersion);
  return card;
}

export async function closeCard(cardId: string, expectedVersion?: number): Promise<KanbanCard | null> {
  try {
    const existing = await getCard(cardId);
    if (!existing) return null;
    const sortOrder = await nextSortOrder(existing.sessionId, existing.boardId, 'done');
    const card = await updateWithVersion(
      cardId,
      expectedVersion,
      `column_name = 'done', blocked = false, sort_order = $1, closed_at = NOW()`,
      [sortOrder],
    );
    emitMove(card, { action: 'close' });
    return card;
  } catch (err) {
    if (err instanceof KanbanWorkflowError) throw err;
    return null;
  }
}

export async function blockCard(cardId: string, reason: string, expectedVersion?: number): Promise<KanbanCard | null> {
  try {
    const card = await updateWithVersion(
      cardId,
      expectedVersion,
      `blocked = true, block_reason = $1, column_name = 'backlog'`,
      [reason],
    );
    emitMove(card, { action: 'block', reason });
    return card;
  } catch (err) {
    if (err instanceof KanbanWorkflowError) throw err;
    return null;
  }
}

export async function unblockCard(cardId: string, expectedVersion?: number): Promise<KanbanCard | null> {
  try {
    const card = await updateWithVersion(
      cardId,
      expectedVersion,
      `blocked = false, block_reason = NULL`,
      [],
    );
    emitMove(card, { action: 'unblock' });
    return card;
  } catch (err) {
    if (err instanceof KanbanWorkflowError) throw err;
    return null;
  }
}

export async function linkCards(cardId: string, linkedCardId: string): Promise<KanbanCard | null> {
  const result = await pool.query(
    `UPDATE kanban_cards SET linked_card_id = $2, version = version + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [cardId, linkedCardId],
  );
  if (!result.rows[0]) return null;
  const card = rowToCard(result.rows[0]);
  emitMove(card, { action: 'link', linked_card_id: linkedCardId });
  return card;
}

export async function addComment(cardId: string, body: string, author = 'agent'): Promise<KanbanComment> {
  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO kanban_comments (id, card_id, author, body) VALUES ($1, $2, $3, $4) RETURNING *`,
    [id, cardId, author, body],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    cardId: String(row.card_id),
    author: String(row.author),
    body: String(row.body),
    createdAt: new Date(String(row.created_at)),
  };
}

export async function listComments(cardId: string): Promise<KanbanComment[]> {
  const result = await pool.query(
    `SELECT * FROM kanban_comments WHERE card_id = $1 ORDER BY created_at ASC`,
    [cardId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    cardId: String(row.card_id),
    author: String(row.author),
    body: String(row.body),
    createdAt: new Date(String(row.created_at)),
  }));
}

export { isCardClaimable } from './kanban-workflow.js';

export async function claimCard(
  cardId: string,
  assignee: string,
  expectedVersion?: number,
): Promise<{ card: KanbanCard | null; error?: string }> {
  try {
    const existing = await getCard(cardId);
    if (!existing) return { card: null, error: 'card not found' };
    const { assertClaimable } = await import('./kanban-workflow.js');
    assertClaimable(existing, assignee);
    const card = await moveCard(cardId, 'in_progress', assignee, expectedVersion ?? existing.version);
    return { card };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { card: null, error: msg };
  }
}

export async function releaseCard(
  cardId: string,
  assignee: string,
  expectedVersion?: number,
): Promise<{ card: KanbanCard | null; error?: string }> {
  try {
    const existing = await getCard(cardId);
    if (!existing) return { card: null, error: 'card not found' };
    if (existing.assignee && existing.assignee !== assignee) {
      return { card: null, error: `assigned to ${existing.assignee}, not ${assignee}` };
    }
    const card = await updateWithVersion(
      cardId,
      expectedVersion ?? existing.version,
      `assignee = NULL, column_name = 'backlog'`,
      [],
    );
    emitMove(card, { action: 'release' });
    return { card };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { card: null, error: msg };
  }
}

export async function listClaimableCards(
  sessionId: string,
  boardId = 'default',
): Promise<KanbanCard[]> {
  const cards = await listCards(sessionId, boardId);
  const { isCardClaimable: claimable } = await import('./kanban-workflow.js');
  return cards.filter(claimable);
}

export async function heartbeatBoard(sessionId: string, boardId = 'default'): Promise<{
  board_id: string;
  total: number;
  in_progress: number;
  blocked: number;
  done: number;
  stale: KanbanCard[];
}> {
  const cards = await listCards(sessionId, boardId);
  const now = Date.now();
  const stale = cards.filter((c) => {
    if (c.column !== 'in_progress') return false;
    const ageHours = (now - c.updatedAt.getTime()) / 3_600_000;
    return ageHours > 24;
  });
  return {
    board_id: boardId,
    total: cards.length,
    in_progress: cards.filter((c) => c.column === 'in_progress').length,
    blocked: cards.filter((c) => c.blocked).length,
    done: cards.filter((c) => c.column === 'done').length,
    stale,
  };
}

export async function getCard(cardId: string): Promise<KanbanCard | null> {
  const result = await pool.query('SELECT * FROM kanban_cards WHERE id = $1', [cardId]);
  if (!result.rows[0]) return null;
  return rowToCard(result.rows[0]);
}

export async function removeCard(cardId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM kanban_cards WHERE id = $1', [cardId]);
  return result.rowCount !== null && result.rowCount > 0;
}

export function groupByColumn(cards: KanbanCard[]): Record<KanbanColumn, KanbanCard[]> {
  const groups: Record<KanbanColumn, KanbanCard[]> = {
    backlog: [],
    in_progress: [],
    review: [],
    done: [],
    blocked: [],
  };
  for (const card of cards) {
    const col = resolveDisplayColumn(card);
    groups[col].push(card);
  }
  return groups;
}

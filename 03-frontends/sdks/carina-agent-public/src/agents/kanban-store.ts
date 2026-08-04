import { pool } from '../memory/db.js';
import { v4 as uuidv4 } from 'uuid';
import { dispatchWebhook } from '../webhooks/dispatcher.js';

export type KanbanColumn = 'backlog' | 'in_progress' | 'review' | 'done' | 'blocked';

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

function rowToCard(row: Record<string, unknown>): KanbanCard {
  const col = String(row.column_name);
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    boardId: String(row.board_id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    column: (col === 'blocked' || row.blocked ? 'blocked' : col) as KanbanColumn,
    assignee: row.assignee ? String(row.assignee) : null,
    priority: Number(row.priority ?? 0),
    blocked: Boolean(row.blocked),
    blockReason: row.block_reason ? String(row.block_reason) : null,
    linkedCardId: row.linked_card_id ? String(row.linked_card_id) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function emitMove(card: KanbanCard, extra: Record<string, unknown> = {}): void {
  void dispatchWebhook('kanban.move', {
    card_id: card.id,
    session_id: card.sessionId,
    board_id: card.boardId,
    column: card.column,
    title: card.title,
    assignee: card.assignee,
    blocked: card.blocked,
    ...extra,
  });
}

export async function createCard(input: {
  sessionId: string;
  boardId?: string;
  title: string;
  description?: string;
  column?: KanbanColumn;
  priority?: number;
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
}): Promise<KanbanCard> {
  const id = uuidv4();
  const column = input.column === 'blocked' ? 'backlog' : (input.column ?? 'backlog');
  const result = await pool.query(
    `INSERT INTO kanban_cards (id, session_id, board_id, title, description, column_name, priority, blocked)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      input.sessionId,
      input.boardId ?? 'default',
      input.title,
      input.description ?? null,
      column,
      input.priority ?? 0,
      input.column === 'blocked',
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
    ? `SELECT * FROM kanban_cards WHERE session_id = $1 AND board_id = $2 AND column_name = $3 ORDER BY priority DESC, created_at ASC`
    : `SELECT * FROM kanban_cards WHERE session_id = $1 AND board_id = $2 ORDER BY priority DESC, created_at ASC`;
  const params = column ? [sessionId, boardId, column] : [sessionId, boardId];
  const result = await pool.query(query, params);
  return result.rows.map(rowToCard);
}

export async function showBoard(sessionId: string, boardId = 'default'): Promise<Record<KanbanColumn, KanbanCard[]>> {
  const cards = await listCards(sessionId, boardId);
  return groupByColumn(cards);
}

export async function moveCard(
  cardId: string,
  column: KanbanColumn,
  assignee?: string,
): Promise<KanbanCard | null> {
  const blocked = column === 'blocked';
  const colName = blocked ? 'backlog' : column;
  const result = await pool.query(
    `UPDATE kanban_cards
     SET column_name = $2, blocked = $3, assignee = COALESCE($4, assignee), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [cardId, colName, blocked, assignee ?? null],
  );
  if (!result.rows[0]) return null;
  const card = rowToCard(result.rows[0]);
  emitMove(card, { action: 'move' });
  return card;
}

export async function completeCard(cardId: string): Promise<KanbanCard | null> {
  return moveCard(cardId, 'done');
}

export async function blockCard(cardId: string, reason: string): Promise<KanbanCard | null> {
  const result = await pool.query(
    `UPDATE kanban_cards
     SET blocked = true, block_reason = $2, column_name = 'backlog', updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [cardId, reason],
  );
  if (!result.rows[0]) return null;
  const card = rowToCard(result.rows[0]);
  emitMove(card, { action: 'block', reason });
  return card;
}

export async function unblockCard(cardId: string): Promise<KanbanCard | null> {
  const result = await pool.query(
    `UPDATE kanban_cards
     SET blocked = false, block_reason = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [cardId],
  );
  if (!result.rows[0]) return null;
  const card = rowToCard(result.rows[0]);
  emitMove(card, { action: 'unblock' });
  return card;
}

export async function linkCards(cardId: string, linkedCardId: string): Promise<KanbanCard | null> {
  const result = await pool.query(
    `UPDATE kanban_cards SET linked_card_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
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
    if (card.blocked) {
      groups.blocked.push(card);
    } else {
      groups[card.column].push(card);
    }
  }
  return groups;
}

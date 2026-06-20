import { Router, type IRouter } from 'express';
import {
  addTrelloComment,
  archiveTrelloCard,
  createTrelloCard,
  getTrelloCard,
  isTrelloConfigured,
  listTrelloBoards,
  listTrelloCards,
  listTrelloLists,
  moveTrelloCard,
  trelloConfigHint,
} from '../integrations/trello-client.js';

export const trelloApiRouter: IRouter = Router();

trelloApiRouter.use((_req, res, next) => {
  if (!isTrelloConfigured()) {
    res.status(503).json({ error: trelloConfigHint() });
    return;
  }
  next();
});

trelloApiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, configured: true });
});

trelloApiRouter.get('/boards', async (_req, res) => {
  try {
    res.json({ boards: await listTrelloBoards() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.get('/boards/:boardId/lists', async (req, res) => {
  try {
    res.json({ lists: await listTrelloLists(req.params.boardId) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.get('/lists/:listId/cards', async (req, res) => {
  try {
    res.json({ cards: await listTrelloCards(req.params.listId) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.get('/cards/:cardId', async (req, res) => {
  try {
    res.json({ card: await getTrelloCard(req.params.cardId) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.post('/cards', async (req, res) => {
  try {
    const listId = String(req.body?.listId ?? req.body?.idList ?? '').trim();
    const name = String(req.body?.name ?? '').trim();
    const desc = String(req.body?.desc ?? '').trim();
    if (!listId || !name) {
      res.status(400).json({ error: 'listId and name are required' });
      return;
    }
    res.status(201).json({ card: await createTrelloCard({ listId, name, desc }) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.post('/cards/:cardId/move', async (req, res) => {
  try {
    const listId = String(req.body?.listId ?? '').trim();
    if (!listId) {
      res.status(400).json({ error: 'listId is required' });
      return;
    }
    await moveTrelloCard(req.params.cardId, listId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.post('/cards/:cardId/comments', async (req, res) => {
  try {
    const text = String(req.body?.text ?? '').trim();
    if (!text) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    await addTrelloComment(req.params.cardId, text);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.post('/cards/:cardId/archive', async (req, res) => {
  try {
    await archiveTrelloCard(req.params.cardId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

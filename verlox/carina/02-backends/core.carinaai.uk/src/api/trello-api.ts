import { Router, type IRouter, type NextFunction, type Request, type Response } from 'express';
import {
  addTrelloComment,
  archiveTrelloCard,
  createTrelloCard,
  getTrelloCard,
  listTrelloBoards,
  listTrelloCards,
  listTrelloLists,
  moveTrelloCard,
  trelloConfigHint,
} from '../integrations/trello-client.js';
import {
  clearTrelloCredentials,
  getTrelloSettingsStatus,
  isTrelloConfigured,
  runWithTrelloTenantScope,
  saveTrelloCredentials,
} from '../integrations/trello-credentials.js';
import { isCloudProxyAuthorized } from '../gateway/cloud-proxy-auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TrelloRequest = Request & {
  trelloTenantId?: string | null;
};

function resolveTrelloTenantId(req: TrelloRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const workspaceId = fromHeader?.trim();
  if (workspaceId && UUID_RE.test(workspaceId)) {
    return workspaceId;
  }
  if (req.session?.hostedAccountId) return req.session.hostedAccountId;
  if (req.session?.webAuthed) return null;
  return null;
}

function withTrelloScope(req: TrelloRequest, res: Response, next: NextFunction): void {
  const tenantId = resolveTrelloTenantId(req);
  runWithTrelloTenantScope(tenantId, () => {
    next();
  });
}

async function requireConfigured(req: TrelloRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!(await isTrelloConfigured())) {
      res.status(503).json({ error: trelloConfigHint() });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

function requireSettingsAuth(req: TrelloRequest, res: Response, next: NextFunction): void {
  const hosted = Boolean(req.session?.hostedAccountId);
  const privateAuthed = Boolean(req.session?.webAuthed);
  const cloudWorkspace = resolveTrelloTenantId(req);
  const cloudProxy = Boolean(cloudWorkspace && isCloudProxyAuthorized(req));
  if (hosted || privateAuthed || cloudProxy) {
    next();
    return;
  }
  res.status(401).json({ error: 'Sign in to manage Trello credentials' });
}

export const trelloApiRouter: IRouter = Router();

trelloApiRouter.use(withTrelloScope);

trelloApiRouter.get('/settings', async (_req, res) => {
  try {
    res.json(await getTrelloSettingsStatus());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.put('/settings', requireSettingsAuth, async (req, res) => {
  try {
    const apiKey = String(req.body?.apiKey ?? '').trim();
    const token = String(req.body?.token ?? '').trim();
    if (!apiKey || !token) {
      res.status(400).json({ error: 'apiKey and token are required' });
      return;
    }
    await saveTrelloCredentials({ apiKey, token });
    res.json(await getTrelloSettingsStatus());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.delete('/settings', requireSettingsAuth, async (_req, res) => {
  try {
    await clearTrelloCredentials();
    res.json(await getTrelloSettingsStatus());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

trelloApiRouter.use(requireConfigured);

trelloApiRouter.get('/health', async (_req, res) => {
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

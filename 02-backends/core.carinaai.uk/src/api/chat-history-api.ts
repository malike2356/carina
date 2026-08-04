import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { getRouter } from '../gateway/router.js';
import { resolveExternalId } from '../gateway/hosted-chat.js';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { getSessionHistory } from '../memory/store.js';
import type { Role } from '../types/index.js';

type HistoryRequest = Request & {
  hostedUser?: { id: string };
};

function chatRolesOnly(role: Role | undefined): role is 'user' | 'assistant' {
  return role === 'user' || role === 'assistant';
}

async function resolveStorageSessionId(req: HistoryRequest, clientSessionId: string): Promise<string> {
  const prior = req.query.sessionId;
  req.query.sessionId = clientSessionId;
  try {
    const externalId = resolveExternalId(req);
    const router = getRouter();
    const webSession = await router.startWebSession(externalId);
    return webSession.sessionId;
  } finally {
    if (prior === undefined) {
      delete req.query.sessionId;
    } else {
      req.query.sessionId = prior;
    }
  }
}

export const chatHistoryRouter: ExpressRouter = Router();

chatHistoryRouter.get('/history/:sessionId', async (req: HistoryRequest, res: Response) => {
  const clientSessionId = String(req.params.sessionId ?? '').trim();
  if (!clientSessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const beforeRaw = String(req.query.before ?? '').trim();
  const before = beforeRaw ? new Date(beforeRaw) : undefined;
  if (beforeRaw && Number.isNaN(before?.getTime())) {
    res.status(400).json({ error: 'before must be a valid ISO timestamp' });
    return;
  }

  if (!req.hostedUser && !req.session?.webAuthed && !isControlAuthorized(req)) {
    const authHeader = req.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ') && !req.session?.hostedAccountId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  try {
    const storageSessionId = await resolveStorageSessionId(req, clientSessionId);
    const memories = await getSessionHistory(storageSessionId, limit + 1, before);
    const hasMore = memories.length > limit;
    const page = hasMore ? memories.slice(0, limit) : memories;

    const messages = page
      .filter((m) => chatRolesOnly(m.role))
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }));

    res.json({
      sessionId: clientSessionId,
      messages,
      hasMore,
      oldestMessageId: messages[0]?.id ?? null,
      newestMessageId: messages[messages.length - 1]?.id ?? null,
    });
  } catch (err) {
    console.error('[chat-history] fetch failed:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

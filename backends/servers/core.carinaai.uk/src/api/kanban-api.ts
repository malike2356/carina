import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { operatorSessionId } from '../ops/operator-profile.js';
import type { KanbanActorRole, KanbanColumn } from '../agents/kanban-types.js';
import { KanbanWorkflowError } from '../agents/kanban-types.js';
import {
  addComment,
  createBoardCard,
  getBoardView,
  listComments,
  orchestratorCloseCard,
  patchCard,
  runCardWork,
  transitionCard,
  workerClaimCard,
  workerReleaseCard,
} from '../agents/kanban-service.js';
import { blockCard, unblockCard } from '../agents/kanban-store.js';

export const kanbanApiRouter: ExpressRouter = Router();

type KanbanRequest = Request & { tenantId?: string };

function kanbanAuth(req: KanbanRequest, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    req.tenantId = '__operator__';
    next();
    return;
  }
  if (req.session?.webAuthed) {
    req.tenantId = '__operator__';
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function resolveSessionId(req: KanbanRequest): string {
  const profile = String(req.query.profile ?? req.body?.profile ?? 'default').trim() || 'default';
  if (req.tenantId === '__operator__') {
    return operatorSessionId(profile);
  }
  return `${req.tenantId}:kanban`;
}

function resolveRole(req: KanbanRequest): KanbanActorRole {
  const role = String(req.query.role ?? req.body?.role ?? 'orchestrator').toLowerCase();
  return role === 'worker' ? 'worker' : 'orchestrator';
}

function workflowStatus(err: unknown): number {
  if (err instanceof KanbanWorkflowError) {
    if (err.code === 'conflict') return 409;
    if (err.code === 'not_found') return 404;
    return 400;
  }
  return 500;
}

kanbanApiRouter.use(kanbanAuth);

kanbanApiRouter.get('/board', async (req: KanbanRequest, res: Response) => {
  try {
    const sessionId = resolveSessionId(req);
    const boardId = String(req.query.board_id ?? 'default');
    const board = await getBoardView(sessionId, boardId);
    res.json(board);
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.post('/cards', async (req: KanbanRequest, res: Response) => {
  try {
    const sessionId = resolveSessionId(req);
    const boardId = String(req.body?.board_id ?? 'default');
    const title = String(req.body?.title ?? '').trim();
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    const card = await createBoardCard(resolveRole(req), {
      sessionId,
      boardId,
      title,
      description: req.body?.description ? String(req.body.description) : undefined,
      column: req.body?.column as KanbanColumn | undefined,
      priority: req.body?.priority != null ? Number(req.body.priority) : undefined,
      workPrompt: req.body?.work_prompt ? String(req.body.work_prompt) : undefined,
      orchestratorNotes: req.body?.orchestrator_notes ? String(req.body.orchestrator_notes) : undefined,
      targetRole: req.body?.target_role,
    });
    res.status(201).json({ card });
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.patch('/cards/:cardId', async (req: KanbanRequest, res: Response) => {
  try {
    const card = await patchCard(resolveRole(req), String(req.params.cardId), {
      expectedVersion: req.body?.version != null ? Number(req.body.version) : undefined,
      title: req.body?.title ? String(req.body.title) : undefined,
      description: req.body?.description !== undefined ? String(req.body.description) : undefined,
      priority: req.body?.priority != null ? Number(req.body.priority) : undefined,
      workPrompt: req.body?.work_prompt !== undefined ? String(req.body.work_prompt) : undefined,
      orchestratorNotes: req.body?.orchestrator_notes !== undefined
        ? String(req.body.orchestrator_notes)
        : undefined,
      resultSummary: req.body?.result_summary !== undefined ? String(req.body.result_summary) : undefined,
    });
    res.json({ card });
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.post('/cards/:cardId/move', async (req: KanbanRequest, res: Response) => {
  try {
    const column = String(req.body?.column ?? '') as KanbanColumn;
    const card = await transitionCard(resolveRole(req), String(req.params.cardId), column, {
      assignee: req.body?.assignee ? String(req.body.assignee) : undefined,
      expectedVersion: req.body?.version != null ? Number(req.body.version) : undefined,
      actor: req.body?.actor ? String(req.body.actor) : undefined,
    });
    res.json({ card });
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.post('/cards/:cardId/claim', async (req: KanbanRequest, res: Response) => {
  try {
    const assignee = String(req.body?.assignee ?? 'operator');
    const card = await workerClaimCard(
      String(req.params.cardId),
      assignee,
      req.body?.version != null ? Number(req.body.version) : undefined,
    );
    res.json({ card });
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.post('/cards/:cardId/release', async (req: KanbanRequest, res: Response) => {
  try {
    const assignee = String(req.body?.assignee ?? 'operator');
    const card = await workerReleaseCard(
      String(req.params.cardId),
      assignee,
      req.body?.version != null ? Number(req.body.version) : undefined,
    );
    res.json({ card });
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.post('/cards/:cardId/close', async (req: KanbanRequest, res: Response) => {
  try {
    if (resolveRole(req) !== 'orchestrator') {
      res.status(400).json({ error: 'Only orchestrators can close cards' });
      return;
    }
    const card = await orchestratorCloseCard(
      String(req.params.cardId),
      req.body?.version != null ? Number(req.body.version) : undefined,
    );
    res.json({ card });
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.post('/cards/:cardId/run', async (req: KanbanRequest, res: Response) => {
  try {
    if (resolveRole(req) !== 'orchestrator') {
      res.status(400).json({ error: 'Only orchestrators can run card work' });
      return;
    }
    const sessionId = resolveSessionId(req);
    const toolsets = Array.isArray(req.body?.toolsets) ? req.body.toolsets.map(String) : undefined;
    const result = await runCardWork(sessionId, String(req.params.cardId), toolsets);
    res.json(result);
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.get('/cards/:cardId/comments', async (req: KanbanRequest, res: Response) => {
  try {
    const comments = await listComments(String(req.params.cardId));
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.post('/cards/:cardId/comments', async (req: KanbanRequest, res: Response) => {
  try {
    const body = String(req.body?.body ?? '').trim();
    if (!body) {
      res.status(400).json({ error: 'body is required' });
      return;
    }
    const author = String(req.body?.author ?? (resolveRole(req) === 'worker' ? 'worker' : 'orchestrator'));
    const comment = await addComment(String(req.params.cardId), body, author);
    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.post('/cards/:cardId/block', async (req: KanbanRequest, res: Response) => {
  try {
    const reason = String(req.body?.reason ?? 'blocked');
    const card = await blockCard(
      String(req.params.cardId),
      reason,
      req.body?.version != null ? Number(req.body.version) : undefined,
    );
    res.json({ card: card ? { card_id: card.id, blocked: card.blocked } : null });
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

kanbanApiRouter.post('/cards/:cardId/unblock', async (req: KanbanRequest, res: Response) => {
  try {
    const card = await unblockCard(
      String(req.params.cardId),
      req.body?.version != null ? Number(req.body.version) : undefined,
    );
    res.json({ card: card ? { card_id: card.id, blocked: card.blocked } : null });
  } catch (err) {
    res.status(workflowStatus(err)).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

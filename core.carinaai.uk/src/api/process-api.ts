import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import {
  getProcessDetail,
  getProcessLog,
  killProcess,
  listProcessesWithPersistence,
} from '../tools/process-registry.js';
import { getPersistedProcess } from '../tools/process-persistence.js';

export const processApiRouter: ExpressRouter = Router();

type ProcessRequest = Request & { tenantId?: string };

function processAuth(req: ProcessRequest, res: Response, next: NextFunction): void {
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

processApiRouter.use(processAuth);

processApiRouter.get('/', async (_req: ProcessRequest, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(_req.query.limit) || 50));
    const processes = await listProcessesWithPersistence(limit);
    res.json({ processes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

processApiRouter.get('/:sessionId', async (req: ProcessRequest, res: Response) => {
  const sessionId = String(req.params.sessionId ?? '').trim();
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  try {
    try {
      const detail = getProcessDetail(sessionId);
      res.json({ process: detail });
      return;
    } catch {
      const persisted = await getPersistedProcess(sessionId);
      if (!persisted) {
        res.status(404).json({ error: 'Process not found' });
        return;
      }
      res.json({
        process: {
          session_id: persisted.id,
          pid: persisted.pid,
          command: persisted.command,
          workdir: persisted.workdir ?? undefined,
          label: persisted.label ?? undefined,
          status: persisted.status,
          started_at: persisted.started_at.toISOString(),
          ended_at: persisted.ended_at?.toISOString(),
          exit_code: persisted.exit_code ?? undefined,
          watch_rules: persisted.watch_rules,
          matched_patterns: persisted.matched_patterns,
          detached: persisted.status === 'running',
        },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

processApiRouter.get('/:sessionId/log', async (req: ProcessRequest, res: Response) => {
  const sessionId = String(req.params.sessionId ?? '').trim();
  const offset = req.query.offset !== undefined ? Number(req.query.offset) : -200;
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : 200;
  try {
    const log = getProcessLog(sessionId, offset, limit);
    res.json(log);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: msg });
  }
});

processApiRouter.post('/:sessionId/kill', async (req: ProcessRequest, res: Response) => {
  const sessionId = String(req.params.sessionId ?? '').trim();
  try {
    const result = await killProcess(sessionId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: msg });
  }
});

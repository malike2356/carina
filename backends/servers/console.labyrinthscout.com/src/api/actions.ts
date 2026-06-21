import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import {
  listPendingActions,
  countPendingActions,
  getPendingAction,
  resolvePendingAction,
  dismissPendingAction,
  logActionExecution,
  listActionExecutions,
} from '../actions/store.js';
import { executeAutoAction } from '../actions/executor.js';
import { PLAYBOOKS } from '../actions/playbook-registry.js';
import { pool } from '../db.js';
import type { SecurityEvent } from '../alerts/types.js';

export const actionsRouter: IRouter = Router();

function operatorId(req: Request): string {
  const r = req as Request & { user?: { username?: string }; operator?: { id?: string } };
  return (
    r.user?.username ??
    r.operator?.id ??
    (typeof req.headers['x-operator-id'] === 'string' ? req.headers['x-operator-id'] : null) ??
    'operator'
  );
}

actionsRouter.get('/executions', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const eventTypeFilter = typeof req.query.event_type === 'string' ? req.query.event_type : null;
    const outcomeFilter = typeof req.query.outcome === 'string' ? req.query.outcome : null;

    let executions = await listActionExecutions(limit * 2);

    if (eventTypeFilter) {
      executions = executions.filter((e) => {
        const meta = e.metadata as Record<string, unknown>;
        return meta.eventType === eventTypeFilter;
      });
    }
    if (outcomeFilter) {
      executions = executions.filter((e) => e.outcome === outcomeFilter);
    }

    res.json({ executions: executions.slice(0, limit), total: executions.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

actionsRouter.get('/pending/count', async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await countPendingActions();
    res.json({ count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

actionsRouter.get('/pending', async (_req: Request, res: Response): Promise<void> => {
  try {
    const pending = await listPendingActions();
    const enriched = pending.map((p) => {
      const playbook = PLAYBOOKS.find((pb) => pb.id === p.playbookId) ?? null;
      return { ...p, playbook };
    });
    res.json({ pending: enriched, count: enriched.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

function paramId(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

actionsRouter.get('/pending/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = paramId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid pending action id' });
      return;
    }
    const pending = await getPendingAction(id);
    if (!pending) {
      res.status(404).json({ error: 'Pending action not found' });
      return;
    }
    const playbook = PLAYBOOKS.find((pb) => pb.id === pending.playbookId) ?? null;
    res.json({ ...pending, playbook });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

actionsRouter.post('/acknowledge', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.event_id !== 'string') {
      res.status(400).json({ error: 'event_id required' });
      return;
    }

    await pool.query(
      `UPDATE security_events
       SET acknowledged = TRUE, acknowledged_at = NOW(), mitigated = TRUE
       WHERE id = $1`,
      [body.event_id],
    );

    await logActionExecution({
      pendingId: null,
      eventId: body.event_id,
      actionId: 'acknowledge-monitor',
      actionLabel: 'Acknowledged and monitoring',
      executedBy: operatorId(req),
      executionType: 'manual',
      outcome: 'success',
      output: 'Event acknowledged by operator',
      metadata: {},
    });

    res.json({ ok: true, message: 'Event acknowledged' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

actionsRouter.post('/:pendingId/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingId = paramId(req.params.pendingId);
    if (!pendingId) {
      res.status(400).json({ error: 'Invalid pending action id' });
      return;
    }
    const body = req.body as Record<string, unknown>;

    if (typeof body.action_id !== 'string' || !body.action_id) {
      res.status(400).json({ error: 'action_id is required' });
      return;
    }

    const pending = await getPendingAction(pendingId);
    if (!pending) {
      res.status(404).json({ error: 'Pending action not found' });
      return;
    }
    if (pending.status !== 'pending') {
      res.status(409).json({ error: `Pending action is already ${pending.status}` });
      return;
    }

    const playbook = PLAYBOOKS.find((pb) => pb.id === pending.playbookId);
    if (!playbook) {
      res.status(500).json({ error: 'Playbook not found for this pending action' });
      return;
    }

    const action = playbook.actions.find((a) => a.id === body.action_id);
    if (!action) {
      res.status(400).json({ error: `Action '${body.action_id}' not found in playbook` });
      return;
    }

    const opId = operatorId(req);
    const isDryRun = body.dry_run === true;

    const mockEvent: SecurityEvent = {
      id: pending.eventId,
      session_id: pending.sessionId ?? '',
      instance_id: pending.instanceId ?? '',
      event_type: pending.eventType ?? '',
      severity: pending.eventSeverity ?? 'info',
      description: pending.eventDescription ?? '',
      created_at: new Date(),
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    };

    let result: { ok: boolean; message: string };

    if (isDryRun) {
      result = { ok: true, message: `Dry run: would execute "${action.label}"` };
    } else if (action.type === 'steps' || action.type === 'script') {
      result = { ok: true, message: `Manual action "${action.label}" recorded; follow the steps in the dashboard` };
    } else {
      result = await executeAutoAction(action, mockEvent);
    }

    await logActionExecution({
      pendingId,
      eventId: pending.eventId,
      actionId: action.id,
      actionLabel: action.label,
      executedBy: opId,
      executionType: 'manual',
      outcome: isDryRun ? 'dry_run' : result.ok ? 'success' : 'failure',
      output: result.message,
      metadata: {
        playbookId: playbook.id,
        dry_run: isDryRun,
        eventType: pending.eventType ?? '',
      },
    });

    if (result.ok && !isDryRun) {
      await resolvePendingAction(pendingId, opId, action.id);
    }

    if (!result.ok && !isDryRun) {
      res.status(500).json({ ok: false, error: result.message });
      return;
    }

    res.json({ ok: true, message: result.message, dry_run: isDryRun });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

actionsRouter.post('/:pendingId/dismiss', async (req: Request, res: Response): Promise<void> => {
  try {
    const pendingId = paramId(req.params.pendingId);
    if (!pendingId) {
      res.status(400).json({ error: 'Invalid pending action id' });
      return;
    }
    const body = req.body as Record<string, unknown>;

    const pending = await getPendingAction(pendingId);
    if (!pending) {
      res.status(404).json({ error: 'Pending action not found' });
      return;
    }
    if (pending.status !== 'pending') {
      res.status(409).json({ error: `Pending action is already ${pending.status}` });
      return;
    }

    const opId = operatorId(req);
    const notes = typeof body.notes === 'string' ? body.notes : 'Dismissed by operator';

    await dismissPendingAction(pendingId, opId, notes);

    await logActionExecution({
      pendingId,
      eventId: pending.eventId,
      actionId: 'dismiss',
      actionLabel: 'Dismissed without action',
      executedBy: opId,
      executionType: 'manual',
      outcome: 'success',
      output: notes,
      metadata: { eventType: pending.eventType ?? '' },
    });

    res.json({ ok: true, message: 'Pending action dismissed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

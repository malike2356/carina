import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { simulateAction } from '../security/action-simulator.js';

export const simulationRouter: IRouter = Router();

simulationRouter.post('/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.session_id !== 'string') {
      res.status(400).json({ error: 'session_id is required' });
      return;
    }

    const result = await simulateAction({
      sessionId: body.session_id,
      instanceId: typeof body.instance_id === 'string' ? body.instance_id : undefined,
      toolName: typeof body.tool_name === 'string' ? body.tool_name : undefined,
      params: typeof body.params === 'object' && body.params !== null
        ? body.params as Record<string, unknown>
        : undefined,
    });

    res.json(result);
  } catch (err) {
    console.error('[scout:simulation] failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

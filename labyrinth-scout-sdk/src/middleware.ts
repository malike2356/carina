import type { NextFunction, Request, Response } from 'express';
import type { ScoutClient } from './client.js';
import { resolveAdapter } from './adapters/adapter-registry.js';

export interface ScoutMiddlewareOptions {
  scout: ScoutClient;
  agentType: string;
  instanceId?: string;
}

export function scoutMiddleware(options: ScoutMiddlewareOptions) {
  const adapter = resolveAdapter(options.agentType);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const normalized = adapter.parseRequest(req.body, {
      path: req.path,
      method: req.method,
      headers: req.headers as Record<string, string>,
    });

    if (!normalized.prompt) {
      next();
      return;
    }

    try {
      const result = await options.scout.evaluateAndWait({
        session_id: normalized.sessionId ?? 'sdk-session',
        instance_id: options.instanceId,
        action_type: 'http',
        content: normalized.prompt,
      });

      if (!result.proceed) {
        res.status(403).json({
          error: {
            message: `Request blocked by Labyrinth Scout: ${result.reason ?? result.decision.reason}`,
            type: 'policy_violation',
            code: result.decision.decision === 'require_approval' ? 'approval_required' : 'policy_blocked',
            riskScore: result.decision.riskScore,
          },
        });
        return;
      }
    } catch {
      // Scout unreachable - fail open (do not block requests when Scout is down)
    }

    next();
  };
}

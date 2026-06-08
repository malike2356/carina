import type { NextFunction, Request, Response } from 'express';
import { resolveAdapter } from './adapter-registry.js';
import { inspectRequest } from './security-pipeline.js';

export interface ScoutMiddlewareOptions {
  agentType: string;
  apiKey?: string;
}

export function scoutMiddleware(options: ScoutMiddlewareOptions) {
  const adapter = resolveAdapter(options.agentType);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = adapter.parseRequest(req.body, {
      path: req.path,
      method: req.method,
      headers: req.headers,
    });
    const decision = await inspectRequest(parsed, req);
    if (decision.blocked) {
      res.status(400).json({
        error: {
          message: `Request blocked by Labyrinth Scout: ${decision.reason ?? 'prompt injection detected'}`,
          type: 'invalid_request_error',
          code: 'prompt_injection_detected',
        },
      });
      return;
    }
    next();
  };
}

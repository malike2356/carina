import type { NextFunction, Request, Response } from 'express';
import { resolveAdapter } from './adapter-registry.js';
import { inspectRequest } from './security-pipeline.js';
import { decisionToHttpStatus, decisionToErrorCode } from '../security/policy-decisions.js';

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
    const result = await inspectRequest(parsed, req);
    if (result.blocked) {
      const decision = result.decision ?? 'block';
      const status = decisionToHttpStatus(decision);
      res.status(status).json({
        error: {
          message: `Request blocked by Labyrinth Scout: ${result.reason ?? 'policy violation'}`,
          type: 'invalid_request_error',
          code: result.code ?? decisionToErrorCode(decision),
          decision,
          riskScore: result.policyDecision?.riskScore,
          shieldMode: result.policyDecision?.shieldMode,
        },
      });
      return;
    }
    next();
  };
}

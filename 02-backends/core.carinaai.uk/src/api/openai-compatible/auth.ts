import type { NextFunction, Request, Response } from 'express';
import { bearerToken, isControlAuthorized } from '../../infrastructure/control-auth.js';
import { opsToken } from '../../ops/ops-config.js';

export function openAiApiEnabled(): boolean {
  return process.env.CARINA_OPENAI_API_ENABLED === 'true';
}

export function isOpenAiApiAuthorized(req: Request): boolean {
  if (isControlAuthorized(req)) return true;
  const token = bearerToken(req);
  if (!token) return false;
  const internal =
    process.env.CARINA_INTERNAL_KEY?.trim()
    || process.env.CARINA_CLOUD_INTERNAL_KEY?.trim()
    || '';
  if (internal && token === internal) return true;
  const ops = opsToken();
  return Boolean(ops && token === ops);
}

export function requireOpenAiAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isOpenAiApiAuthorized(req)) {
    res.status(401).json({
      error: {
        message: 'Missing or invalid Authorization header',
        type: 'authentication_error',
      },
    });
    return;
  }
  next();
}

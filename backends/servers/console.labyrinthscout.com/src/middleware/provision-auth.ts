import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export function requireProvisionSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = config.auth.provisionSecret;
  if (!secret) {
    res.status(503).json({ error: 'Provisioning is not configured' });
    return;
  }
  const provided = req.headers['x-scout-provision-secret'];
  if (typeof provided !== 'string' || provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

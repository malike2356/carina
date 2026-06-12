import fs from 'fs';
import type { Request, Response, NextFunction } from 'express';
import { opsToken } from '../../ops/ops-config.js';

export function acpPasswordFilePath(): string | undefined {
  return process.env.CARINA_ACP_PASSWORD_FILE?.trim() || undefined;
}

export function acpAuthRequired(): boolean {
  if (process.env.CARINA_ACP_AUTH === 'off') return false;
  if (acpPasswordFilePath()) return true;
  if (process.env.CARINA_ACP_AUTH === 'required') return true;
  return Boolean(process.env.CARINA_WEB_PASSWORD || process.env.CARINA_OPS_TOKEN || opsToken());
}

export function resolveAcpPassword(): string | undefined {
  const file = acpPasswordFilePath();
  if (file) {
    try {
      return fs.readFileSync(file, 'utf-8').trim();
    } catch {
      return undefined;
    }
  }
  return process.env.CARINA_ACP_PASSWORD
    ?? process.env.CARINA_WEB_PASSWORD
    ?? process.env.CARINA_OPS_TOKEN
    ?? opsToken()
    ?? undefined;
}

export function acpBearerToken(req: Request): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export function isAcpAuthorized(req: Request): boolean {
  if (!acpAuthRequired()) return true;
  const expected = resolveAcpPassword();
  if (!expected) return false;
  return acpBearerToken(req) === expected;
}

export function requireAcpAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAcpAuthorized(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'ACP unauthorized' });
}

export type AcpBridgeMode = 'client' | 'bridge' | 'server';

export function acpBridgeMode(): AcpBridgeMode {
  const raw = process.env.CARINA_ACP_MODE ?? 'server';
  if (raw === 'client' || raw === 'bridge') return raw;
  return 'server';
}

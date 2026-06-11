import type { Request } from 'express';
import { opsToken } from '../ops/ops-config.js';
import { validateDeviceToken } from './device-pairing.js';

export function bearerToken(req: Request): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export function isControlAuthorized(req: Request): boolean {
  if (req.session?.webAuthed || req.session?.hostedAccountId) return true;
  const token = bearerToken(req);
  if (!token) return false;
  const ops = opsToken();
  if (ops && token === ops) return true;
  return validateDeviceToken(token) !== null;
}

export function pairedDeviceFromRequest(req: Request) {
  const token = bearerToken(req);
  if (!token) return null;
  return validateDeviceToken(token);
}

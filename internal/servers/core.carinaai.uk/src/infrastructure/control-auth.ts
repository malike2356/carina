import type { Request, Response } from 'express';
import { opsToken } from '../ops/ops-config.js';
import { validateDeviceToken } from './device-pairing.js';
import {
  controlScopesForRoute,
  deviceHasAnyScope,
  type DeviceScope,
} from './device-scopes.js';

export type ControlRoute = 'nodes' | 'approvals' | 'phone' | 'general';

export function bearerToken(req: Request): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

export function pairedDeviceFromRequest(req: Request) {
  const token = bearerToken(req);
  if (!token) return null;
  return validateDeviceToken(token);
}

function sessionOrOpsAuthorized(req: Request, token: string): boolean {
  if (req.session?.webAuthed || req.session?.hostedAccountId) return true;
  const ops = opsToken();
  return Boolean(ops && token === ops);
}

export function isControlAuthorizedForScope(req: Request, route: ControlRoute = 'general'): boolean {
  if (req.session?.webAuthed || req.session?.hostedAccountId) return true;
  const token = bearerToken(req);
  if (!token) return false;
  if (sessionOrOpsAuthorized(req, token)) return true;
  const device = validateDeviceToken(token);
  if (!device) return false;
  const required: DeviceScope[] = controlScopesForRoute(route);
  return deviceHasAnyScope(device, required);
}

export function isControlAuthorized(req: Request): boolean {
  return isControlAuthorizedForScope(req, 'general');
}

export function requireControlScope(req: Request, res: Response, route: ControlRoute): boolean {
  if (isControlAuthorizedForScope(req, route)) return true;
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  res.status(403).json({
    error: 'Insufficient device scope for this action',
    code: 'DEVICE_SCOPE_DENIED',
    requiredScopes: controlScopesForRoute(route),
  });
  return false;
}

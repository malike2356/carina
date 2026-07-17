import type { Request, Response, NextFunction } from 'express';
import { loginAdminOperatorViaGoogle } from './admin-bridge.js';
import { findUserById } from './ops-users.js';

/** Refresh a few minutes early so mid-page API calls do not race expiry. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

function adminTokenExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isAdminTokenUsable(token: string | undefined, nowMs = Date.now()): boolean {
  if (!token?.trim()) return false;
  const exp = adminTokenExpiryMs(token);
  if (exp === null) return false;
  return exp - REFRESH_SKEW_MS > nowMs;
}

export async function applyBusinessAdminBridge(req: Request): Promise<boolean> {
  if (isAdminTokenUsable(req.session?.adminToken)) return true;

  let email = req.session?.adminEmail?.trim().toLowerCase();
  if (!email && req.session?.userId) {
    const opsUser = await findUserById(req.session.userId);
    email = opsUser?.email?.trim().toLowerCase();
  }
  if (!email) return false;

  const bridge = await loginAdminOperatorViaGoogle(email);
  if (bridge.step !== 'complete' || !bridge.adminToken) return false;

  req.session.adminToken = bridge.adminToken;
  req.session.adminEmail = bridge.email ?? email;
  req.session.adminUserId = bridge.userId;
  return true;
}

export async function ensureBusinessAdminSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isAdminTokenUsable(req.session?.adminToken)) {
    next();
    return;
  }

  try {
    const bridged = await applyBusinessAdminBridge(req);
    if (bridged) {
      req.session.save((err) => {
        if (err) console.error('[ensureBusinessAdminSession]', err);
        next();
      });
      return;
    }
  } catch (err) {
    console.error('[ensureBusinessAdminSession] bridge failed:', err);
  }

  next();
}

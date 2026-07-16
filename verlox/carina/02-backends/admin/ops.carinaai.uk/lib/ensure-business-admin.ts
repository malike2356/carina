import type { Request, Response, NextFunction } from 'express';
import { loginAdminOperatorViaGoogle } from './admin-bridge.js';
import { findUserById } from './ops-users.js';

export async function applyBusinessAdminBridge(req: Request): Promise<boolean> {
  if (req.session?.adminToken) return true;

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
  if (req.session?.adminToken) {
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

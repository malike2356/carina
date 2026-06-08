import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { findAccountByApiKey } from '../lib/accounts.js';

export type ScoutAuth =
  | { kind: 'operator' }
  | { kind: 'account'; accountId: string };

declare module 'express-serve-static-core' {
  interface Request {
    scoutAuth?: ScoutAuth;
  }
}

function keysMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAllowedIp(req: Request): boolean {
  if (config.auth.ipWhitelist.length === 0) return true;
  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  return config.auth.ipWhitelist.includes(ip) || config.auth.ipWhitelist.includes(ip.replace(/^::ffff:/, ''));
}

function verifyTotp(req: Request): boolean {
  if (!config.auth.totpSecret) return true;
  const token = req.headers['x-scout-totp'];
  if (typeof token !== 'string' || !/^\d{6}$/.test(token)) return false;
  const nowStep = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((offset) => token === generateTotp(config.auth.totpSecret, nowStep + offset));
}

function generateTotp(secret: string, step: number): string {
  const key = decodeBase32(secret);
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(step / 0x100000000), 0);
  msg.writeUInt32BE(step >>> 0, 4);
  const hmac = createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function decodeBase32(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of input.toUpperCase().replace(/=|\s|-/g, '')) {
    const value = alphabet.indexOf(ch);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Accepts either the operator's global SCOUT_API_KEY (full dashboard access,
 * used by the operator's own Carina instances) or a subscriber account key
 * (scoped access, used by self-hosted Carina instances pairing with Scout).
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!isAllowedIp(req)) {
    res.status(403).json({ error: 'IP not allowed' });
    return;
  }

  if (!verifyTotp(req)) {
    res.status(401).json({ error: 'Two-factor token required' });
    return;
  }

  const key = req.headers['x-scout-key'];
  if (typeof key !== 'string' || !key) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (keysMatch(key, config.auth.apiKey)) {
    req.scoutAuth = { kind: 'operator' };
    next();
    return;
  }

  void findAccountByApiKey(key)
    .then((account) => {
      if (!account) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      req.scoutAuth = { kind: 'account', accountId: account.id };
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Unauthorized' });
    });
}

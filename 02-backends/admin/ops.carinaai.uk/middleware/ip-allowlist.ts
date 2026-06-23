import type { Request, Response, NextFunction } from 'express';

function requestPath(req: Request): string {
  return (req.originalUrl ?? req.url ?? req.path ?? '').split('?')[0] ?? req.path;
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) return trimmed.slice('::ffff:'.length);
  return trimmed;
}

function clientIp(req: Request): string {
  const cfConnectingIp = req.get('cf-connecting-ip')?.trim();
  if (cfConnectingIp) return normalizeIp(cfConnectingIp);

  const forwarded = req.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return normalizeIp(forwarded);

  return normalizeIp(req.ip ?? req.socket.remoteAddress ?? '');
}

function allowedIps(): string[] {
  const raw = process.env.OPS_ALLOWED_IPS?.trim();
  if (!raw) return [];
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function requireAllowedIp(req: Request, res: Response, next: NextFunction): void {
  const allowed = allowedIps();
  if (allowed.length === 0) {
    next();
    return;
  }

  const path = requestPath(req);
  if (path === '/health') {
    next();
    return;
  }

  const ip = clientIp(req);
  const allowedNormalized = allowed.map((entry) => normalizeIp(entry));
  if (allowedNormalized.includes(ip)) {
    next();
    return;
  }

  if (req.get('accept')?.includes('application/json') || path.startsWith('/api/') || path.startsWith('/scout-api')) {
    res.status(403).json({ ok: false, error: 'Forbidden: IP not allowed.' });
    return;
  }

  res.status(403).render('error', {
    title: 'Forbidden',
    message: 'This admin panel is restricted to approved network addresses.',
  });
}

export function parseAllowedIps(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((entry) => normalizeIp(entry.trim())).filter(Boolean);
}

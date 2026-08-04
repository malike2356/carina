import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimits.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return true;
  }
  return entry.count < MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function coreBaseUrl(): string {
  return (process.env.ADMIN_CORE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

type CoreLoginResponse = {
  step?: 'complete' | 'totp_setup' | 'totp_verify';
  adminToken?: string;
  pendingToken?: string;
  email?: string;
  userId?: string;
  otpauthUrl?: string;
  error?: string;
};

async function coreLogin(body: Record<string, string>): Promise<Response> {
  return fetch(`${coreBaseUrl()}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

async function saveFullSession(data: CoreLoginResponse): Promise<void> {
  const session = await getAdminSession();
  session.email = String(data.email);
  session.userId = String(data.userId);
  session.adminToken = String(data.adminToken);
  session.isAdmin = true;
  session.pendingTotp = undefined;
  session.pendingToken = undefined;
  session.totpAttempts = undefined;
  await session.save();
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  let body: { email?: string; password?: string; totpCode?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string; totpCode?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';
  const totpCode = body.totpCode?.trim();
  if (!email || !password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  try {
    const res = await coreLogin({
      email,
      password,
      ...(totpCode ? { totpCode } : {}),
    });
    const data = (await res.json()) as CoreLoginResponse;
    if (!res.ok) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: data.error ?? 'Invalid credentials' }, { status: res.status });
    }

    if (data.step === 'complete' && data.adminToken) {
      await saveFullSession(data);
      return NextResponse.json({ ok: true, step: 'complete' });
    }

    if ((data.step === 'totp_setup' || data.step === 'totp_verify') && data.pendingToken) {
      const session = await getAdminSession();
      session.pendingTotp = data.step;
      session.pendingToken = data.pendingToken;
      session.email = email;
      session.userId = String(data.userId ?? '');
      session.pendingOtpauthUrl = data.otpauthUrl;
      session.isAdmin = false;
      session.adminToken = '';
      session.totpAttempts = 0;
      await session.save();
      return NextResponse.json({ step: data.step });
    }

    recordFailedAttempt(ip);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
}

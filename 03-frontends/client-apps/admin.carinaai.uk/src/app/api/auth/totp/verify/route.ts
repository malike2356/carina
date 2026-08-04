import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

const MAX_TOTP_ATTEMPTS = 5;

function coreBaseUrl(): string {
  return (process.env.ADMIN_CORE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session.pendingToken || session.pendingTotp !== 'totp_verify') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const attempts = session.totpAttempts ?? 0;
  if (attempts >= MAX_TOTP_ATTEMPTS) {
    session.destroy();
    return NextResponse.json({ error: 'Too many attempts. Sign in again.' }, { status: 429 });
  }

  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  const code = String(body.code ?? '').trim();
  if (!code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  const res = await fetch(`${coreBaseUrl()}/api/admin/auth/totp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pendingToken: session.pendingToken, code }),
    cache: 'no-store',
  });
  const data = (await res.json()) as {
    step?: string;
    adminToken?: string;
    email?: string;
    userId?: string;
    error?: string;
  };

  if (!res.ok || data.step !== 'complete' || !data.adminToken) {
    session.totpAttempts = attempts + 1;
    await session.save();
    if (session.totpAttempts >= MAX_TOTP_ATTEMPTS) {
      session.destroy();
      return NextResponse.json({ error: 'Too many attempts. Sign in again.' }, { status: 429 });
    }
    return NextResponse.json({ error: data.error ?? 'Invalid code' }, { status: 401 });
  }

  session.email = String(data.email);
  session.userId = String(data.userId);
  session.adminToken = data.adminToken;
  session.isAdmin = true;
  session.pendingTotp = undefined;
  session.pendingToken = undefined;
  session.totpAttempts = 0;
  await session.save();

  return NextResponse.json({ ok: true });
}

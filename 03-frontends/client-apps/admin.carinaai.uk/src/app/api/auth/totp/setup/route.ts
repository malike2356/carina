import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

function coreBaseUrl(): string {
  return (process.env.ADMIN_CORE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session.pendingToken || session.pendingTotp !== 'totp_setup') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const res = await fetch(`${coreBaseUrl()}/api/admin/auth/totp/setup/verify`, {
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
    return NextResponse.json({ error: data.error ?? 'Invalid code' }, { status: 401 });
  }

  session.email = String(data.email);
  session.userId = String(data.userId);
  session.adminToken = data.adminToken;
  session.isAdmin = true;
  session.pendingTotp = undefined;
  session.pendingToken = undefined;
  session.pendingOtpauthUrl = undefined;
  session.totpAttempts = 0;
  await session.save();

  return NextResponse.json({ ok: true });
}

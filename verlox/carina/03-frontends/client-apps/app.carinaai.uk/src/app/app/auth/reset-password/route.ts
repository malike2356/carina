import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readAuthError } from '@/lib/mobile-auth-shim';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  const token = String(body.token ?? '').trim();
  const password = String(body.password ?? '');
  if (!token || password.length < 10) {
    return NextResponse.json(
      { error: 'token and password (10+ characters) are required' },
      { status: 400 },
    );
  }

  try {
    const authResponse = await auth.api.resetPassword({
      body: { token, newPassword: password },
      asResponse: true,
    });
    if (!authResponse.ok) {
      const message = await readAuthError(authResponse);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reset failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

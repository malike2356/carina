import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  extractSessionToken,
  jsonAuthOk,
  readAuthError,
} from '@/lib/mobile-auth-shim';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }

  try {
    const authResponse = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    if (!authResponse.ok) {
      const message = await readAuthError(authResponse);
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return jsonAuthOk(extractSessionToken(authResponse), authResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sign in failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

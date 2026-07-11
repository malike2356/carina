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
    name?: string;
  };
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const name = String(body.name ?? email.split('@')[0] ?? 'User').trim() || 'User';
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 });
  }

  try {
    const authResponse = await auth.api.signUpEmail({
      body: { email, password, name },
      asResponse: true,
    });
    if (!authResponse.ok) {
      const message = await readAuthError(authResponse);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const token = extractSessionToken(authResponse);
    return jsonAuthOk(token, authResponse, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

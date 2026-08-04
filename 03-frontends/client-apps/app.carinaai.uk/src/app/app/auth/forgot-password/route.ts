import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { readAuthError } from '@/lib/mobile-auth-shim';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const callbackURL = new URL('/reset-password', request.url).toString();
  const authResponse = await auth.api.requestPasswordReset({
    body: { email, redirectTo: callbackURL },
    asResponse: true,
  });
  if (!authResponse.ok) {
    return NextResponse.json({ error: await readAuthError(authResponse) }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

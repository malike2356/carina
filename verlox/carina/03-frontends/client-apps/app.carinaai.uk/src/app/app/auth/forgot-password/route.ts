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

  try {
    const authResponse = await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: '/reset-password',
      },
      asResponse: true,
    });
    if (!authResponse.ok) {
      // Avoid email enumeration; still report soft failure for disabled mail.
      const message = await readAuthError(authResponse);
      if (/disabled|not configured|resend/i.test(message)) {
        return NextResponse.json({ ok: false, emailDisabled: true });
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

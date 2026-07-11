import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { forwardAuthCookies, readAuthError } from '@/lib/mobile-auth-shim';
import { authRequestHeaders } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const headers = await authRequestHeaders();
    const authResponse = await auth.api.signOut({
      headers,
      asResponse: true,
    });
    if (!authResponse.ok) {
      const message = await readAuthError(authResponse);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const response = NextResponse.json({ ok: true });
    forwardAuthCookies(authResponse, response);
    return response;
  } catch {
    return NextResponse.json({ ok: true });
  }
}

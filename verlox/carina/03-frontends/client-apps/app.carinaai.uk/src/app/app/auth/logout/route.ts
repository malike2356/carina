import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { authRequestHeaders } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const authResponse = await auth.api.signOut({
    headers: await authRequestHeaders(),
    asResponse: true,
  });
  const response = NextResponse.json({ ok: true }, { status: authResponse.ok ? 200 : 400 });
  for (const cookie of authResponse.headers.getSetCookie()) {
    response.headers.append('Set-Cookie', cookie);
  }
  return response;
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'login token is required' }, { status: 400 });
  }

  return NextResponse.json(
    { error: 'Login token is invalid or expired. Sign in with email instead.' },
    { status: 400 },
  );
}

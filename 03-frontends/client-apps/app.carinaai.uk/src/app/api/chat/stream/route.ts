import { NextResponse } from 'next/server';
import { POST as postChat } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const message = String(url.searchParams.get('message') ?? '').trim();
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

  const forwarded = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({
      message,
      sessionId: url.searchParams.get('sessionId') ?? undefined,
      provider: url.searchParams.get('provider') ?? undefined,
      model: url.searchParams.get('model') ?? undefined,
    }),
  });

  return postChat(forwarded);
}

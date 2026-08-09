import { NextResponse } from 'next/server';
import { proxyToCoreApi } from '@/lib/core-api-proxy';

type Params = { params: Promise<{ eventId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { eventId } = await params;
  const id = String(eventId ?? '').trim();
  if (!id) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }
  try {
    return await proxyToCoreApi(request, `/api/aiva/propreneur/replay/${encodeURIComponent(id)}`);
  } catch {
    return NextResponse.json({ error: 'Replay proxy failed' }, { status: 502 });
  }
}

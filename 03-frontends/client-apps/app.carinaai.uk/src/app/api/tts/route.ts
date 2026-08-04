import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { checkLegalGate } from '@/lib/legal/legal-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TTS_CHARS = 4000;

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const gate = await checkLegalGate(session.user.id, workspace.id);
    if (gate) {
      return NextResponse.json(gate, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { text?: string } | null;
    const text = String(body?.text ?? '').trim();
    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (text.length > MAX_TTS_CHARS) {
      return NextResponse.json(
        { error: `text too long (max ${MAX_TTS_CHARS} characters)` },
        { status: 400 },
      );
    }

    const upstream = await proxyAivaRequest(workspace.id, '/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!upstream.ok) {
      const contentType = upstream.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const errBody = await upstream.text();
        return new NextResponse(errBody, {
          status: upstream.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return NextResponse.json(
        { error: `TTS failed (${upstream.status})` },
        { status: upstream.status },
      );
    }

    const audio = await upstream.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TTS unavailable';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { requireSession, requireWorkspace } from '@/lib/session';
import { respondAuthError } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const incoming = new URL(request.url);
    const upstream = await proxyAivaRequest(
      workspace.id,
      `/api/onboarding/channels${incoming.search}`,
      { method: 'GET' },
    );
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return respondAuthError(err);
  }
}

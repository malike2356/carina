import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';

export const dynamic = 'force-dynamic';

/**
 * Kicks off the YouTube OAuth flow: asks core for a signed authorize URL,
 * then redirects the browser to Google's consent screen.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const returnPath = (url.searchParams.get('returnPath') ?? '/aiva/outreach/channels/youtube/setup').trim();

  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);

    const query = new URLSearchParams({ returnPath });
    const upstream = await proxyAivaRequest(
      workspace.id,
      `/api/aiva/youtube/oauth/auth-url?${query.toString()}`,
      { method: 'GET' },
    );

    if (!upstream.ok) {
      const target = new URL(returnPath, url.origin);
      target.searchParams.set('youtube_error', 'not_configured');
      return NextResponse.redirect(target.toString());
    }

    const data = (await upstream.json()) as { authUrl?: string };
    if (!data.authUrl) {
      const target = new URL(returnPath, url.origin);
      target.searchParams.set('youtube_error', 'not_configured');
      return NextResponse.redirect(target.toString());
    }

    return NextResponse.redirect(data.authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    if (message === 'Unauthorized') {
      const login = new URL('/login', url.origin);
      login.searchParams.set('returnTo', `/api/aiva/youtube/oauth/start?returnPath=${encodeURIComponent(returnPath)}`);
      return NextResponse.redirect(login.toString());
    }
    const target = new URL(returnPath, url.origin);
    target.searchParams.set('youtube_error', 'server_error');
    return NextResponse.redirect(target.toString());
  }
}

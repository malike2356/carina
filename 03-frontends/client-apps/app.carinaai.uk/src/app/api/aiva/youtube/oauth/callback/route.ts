import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';

export const dynamic = 'force-dynamic';

const DEFAULT_RETURN_PATH = '/aiva/outreach/channels/youtube/setup';

/**
 * Google redirects here after the user allows or denies YouTube access.
 * The code and state are handed to core, which verifies the state,
 * exchanges the code for tokens, and stores them encrypted.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = (url.searchParams.get('code') ?? '').trim();
  const state = (url.searchParams.get('state') ?? '').trim();
  const oauthError = (url.searchParams.get('error') ?? '').trim();

  const redirectTo = (path: string, query: Record<string, string>) => {
    const target = new URL(path, url.origin);
    for (const [k, v] of Object.entries(query)) {
      target.searchParams.set(k, v);
    }
    return NextResponse.redirect(target.toString());
  };

  if (oauthError) {
    return redirectTo(DEFAULT_RETURN_PATH, {
      youtube_error: oauthError === 'access_denied' ? 'denied' : oauthError,
    });
  }

  if (!code || !state) {
    return redirectTo(DEFAULT_RETURN_PATH, { youtube_error: 'missing_code' });
  }

  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);

    const upstream = await proxyAivaRequest(workspace.id, '/api/aiva/youtube/oauth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });

    const data = (await upstream.json().catch(() => ({}))) as {
      ok?: boolean;
      channelId?: string;
      channelTitle?: string;
      returnPath?: string | null;
      error?: string;
    };

    const returnPath = data.returnPath || DEFAULT_RETURN_PATH;

    if (!upstream.ok || !data.ok) {
      return redirectTo(returnPath, { youtube_error: data.error ?? 'exchange_failed' });
    }

    return redirectTo(returnPath, {
      youtube_connected: '1',
      channel_id: data.channelId ?? '',
      channel_title: data.channelTitle ?? '',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    if (message === 'Unauthorized') {
      const login = new URL('/login', url.origin);
      login.searchParams.set(
        'returnTo',
        `/api/aiva/youtube/oauth/callback?${url.searchParams.toString()}`,
      );
      return NextResponse.redirect(login.toString());
    }
    return redirectTo(DEFAULT_RETURN_PATH, { youtube_error: 'server_error' });
  }
}

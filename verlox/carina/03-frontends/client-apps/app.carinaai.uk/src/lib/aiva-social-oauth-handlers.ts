import { NextRequest, NextResponse } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import {
  aivaSocialOAuthRedirectUri,
  SOCIAL_OAUTH_STUB_BODY,
  type SocialOAuthProvider,
} from '@/lib/aiva-social-oauth';
import { requireSession, requireWorkspace } from '@/lib/session';
import { respondAuthError } from '@/lib/api-auth';

export function createSocialAuthUrlHandler(provider: SocialOAuthProvider) {
  return async function GET(request: NextRequest): Promise<NextResponse> {
    try {
      const session = await requireSession();
      const workspace = await requireWorkspace(session.user.id);
      const incoming = new URL(request.url);
      const workerId = incoming.searchParams.get('workerId') ?? '';
      const channel = incoming.searchParams.get('channel') ?? '';
      const redirectUri = aivaSocialOAuthRedirectUri(request, provider);
      const params = new URLSearchParams({ workerId, redirectUri });
      if (channel) params.set('channel', channel);

      const upstream = await proxyAivaRequest(
        workspace.id,
        `/api/aiva/social/oauth/${provider}/auth-url?${params.toString()}`,
      );
      if (!upstream.ok) {
        return NextResponse.json(SOCIAL_OAUTH_STUB_BODY, { status: upstream.status === 503 ? 503 : 501 });
      }

      const text = await upstream.text();
      const response = new NextResponse(text, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
      });

      if (provider === 'twitter') {
        try {
          const data = JSON.parse(text) as { state?: string };
          if (data.state) {
            response.cookies.set('twitter_oauth_state', data.state, {
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              maxAge: 900,
              path: '/',
            });
          }
        } catch {
          // ignore parse errors
        }
      }

      return response;
    } catch (err) {
      return respondAuthError(err);
    }
  };
}

export function createSocialCallbackHandler(provider: SocialOAuthProvider) {
  return async function GET(request: NextRequest): Promise<NextResponse> {
    const url = new URL(request.url);
    const error = url.searchParams.get('error') ?? url.searchParams.get('error_description') ?? '';

    if (error) {
      return redirectWith(url, 'channel_error', error);
    }

    try {
      if (provider === 'twitter') {
        const oauthToken = url.searchParams.get('oauth_token') ?? '';
        const oauthVerifier = url.searchParams.get('oauth_verifier') ?? '';
        const state = request.cookies.get('twitter_oauth_state')?.value ?? '';
        if (!oauthToken || !oauthVerifier || !state) {
          return redirectWith(url, 'channel_error', 'twitter_auth_failed');
        }
        const response = await proxyAivaRequest(
          null,
          '/api/aiva/social/oauth/twitter/callback',
          {
            method: 'POST',
            body: JSON.stringify({ oauthToken, oauthVerifier, state }),
            headers: { 'Content-Type': 'application/json' },
          },
        );
        const redirect = response.ok
          ? redirectToWorker(url, (await response.json() as { workerId?: string }).workerId, 'twitter')
          : redirectWith(url, 'channel_error', 'twitter_auth_failed');
        redirect.cookies.delete('twitter_oauth_state');
        return redirect;
      }

      const code = url.searchParams.get('code') ?? '';
      const state = url.searchParams.get('state') ?? '';
      if (!code || !state) {
        return redirectWith(url, 'channel_error', `${provider}_auth_failed`);
      }

      const response = await proxyAivaRequest(
        null,
        `/api/aiva/social/oauth/${provider}/callback`,
        {
          method: 'POST',
          body: JSON.stringify({
            code,
            state,
            redirectUri: aivaSocialOAuthRedirectUri(request, provider),
          }),
          headers: { 'Content-Type': 'application/json' },
        },
      );
      if (!response.ok) {
        return redirectWith(url, 'channel_error', `${provider}_auth_failed`);
      }

      const data = await response.json() as {
        workerId?: string;
        connectToken?: string;
      };

      if (provider === 'meta' && data.connectToken && data.workerId) {
        const redirect = new URL(`/aiva/workers/${data.workerId}`, url.origin);
        redirect.searchParams.set('tab', 'channels');
        redirect.searchParams.set('channel_connected', 'meta');
        redirect.searchParams.set('meta_connect_token', data.connectToken);
        return NextResponse.redirect(redirect.toString());
      }

      return redirectToWorker(url, data.workerId, provider);
    } catch {
      return redirectWith(url, 'channel_error', 'server_error');
    }
  };
}

function redirectToWorker(
  url: URL,
  workerId: string | undefined,
  provider: string,
): NextResponse {
  if (workerId) {
    const redirect = new URL(`/aiva/workers/${workerId}`, url.origin);
    redirect.searchParams.set('tab', 'channels');
    redirect.searchParams.set('channel_connected', provider);
    return NextResponse.redirect(redirect.toString());
  }
  return redirectWith(url, 'channel_connected', provider);
}

function redirectWith(url: URL, key: string, value: string): NextResponse {
  const redirect = new URL('/aiva/workers', url.origin);
  redirect.searchParams.set(key, value);
  return NextResponse.redirect(redirect.toString());
}

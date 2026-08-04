import { NextRequest, NextResponse } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { getPublicOrigin } from '@/lib/public-origin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const error = url.searchParams.get('error') ?? '';

  if (error) {
    return redirectWith(request, null, 'tools_oauth_error', error);
  }

  try {
    const response = await proxyAivaRequest(null, '/api/aiva/tools/oauth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = (await response.json()) as {
      ok?: boolean;
      toolSlug?: string;
      error?: string;
      returnPath?: string | null;
    };
    if (!response.ok) {
      return redirectWith(request, null, 'tools_oauth_error', body.error ?? 'google_auth_failed');
    }
    const returnPath = sanitizeReturnPath(body.returnPath);
    return redirectWith(
      request,
      returnPath,
      body.ok === false ? 'tools_oauth_error' : 'tools_oauth_ok',
      body.ok === false ? (body.error ?? 'probe_failed') : (body.toolSlug ?? 'google'),
    );
  } catch {
    return redirectWith(request, null, 'tools_oauth_error', 'server_error');
  }
}

function sanitizeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  if (value.startsWith('/aiva/tools')) return value;
  if (value.startsWith('/aiva/workers/')) return value;
  if (value.startsWith('/aiva/org')) return value;
  if (value === '/email' || value.startsWith('/email?')) return value;
  if (value === '/documents' || value.startsWith('/documents?')) return value;
  return null;
}

function redirectWith(
  request: NextRequest,
  returnPath: string | null,
  key: string,
  value: string,
): NextResponse {
  const fallback =
    returnPath?.startsWith('/aiva/tools')
      ? '/aiva/tools'
      : returnPath === '/email' || returnPath?.startsWith('/email?')
        ? '/email'
        : '/aiva/workers';
  const redirect = new URL(returnPath || fallback, getPublicOrigin(request));
  if (returnPath?.startsWith('/aiva/workers/') && !redirect.searchParams.has('tab')) {
    redirect.searchParams.set('tab', 'channels');
  }
  redirect.searchParams.set(key, value);
  return NextResponse.redirect(redirect.toString());
}

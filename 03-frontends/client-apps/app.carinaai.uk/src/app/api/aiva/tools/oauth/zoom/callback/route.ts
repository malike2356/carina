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
    return redirectWith(request, null, 'zoom_oauth_error', error);
  }

  try {
    const response = await proxyAivaRequest(null, '/api/aiva/tools/oauth/zoom/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
      headers: { 'Content-Type': 'application/json' },
    });
    const body = (await response.json()) as {
      connected?: boolean;
      error?: string;
      returnPath?: string | null;
    };
    if (!response.ok) {
      return redirectWith(request, null, 'zoom_oauth_error', body.error ?? 'zoom_auth_failed');
    }
    const returnPath = sanitizeReturnPath(body.returnPath);
    return redirectWith(request, returnPath, 'zoom_oauth_ok', 'zoom');
  } catch {
    return redirectWith(request, null, 'zoom_oauth_error', 'server_error');
  }
}

function sanitizeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  if (value.startsWith('/aiva/workers/')) return value;
  return null;
}

function redirectWith(
  request: NextRequest,
  returnPath: string | null,
  key: string,
  value: string,
): NextResponse {
  const redirect = new URL(returnPath || '/aiva/workers', getPublicOrigin(request));
  if (returnPath?.startsWith('/aiva/workers/') && !redirect.searchParams.has('tab')) {
    redirect.searchParams.set('tab', 'concierge');
  }
  redirect.searchParams.set(key, value);
  return NextResponse.redirect(redirect.toString());
}

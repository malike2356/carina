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
    return redirectWith(request, 'channel_error', error);
  }

  try {
    const response = await proxyAivaRequest(
      null,
      '/api/aiva/email/oauth/outlook/callback',
      {
        method: 'POST',
        body: JSON.stringify({ code, state }),
        headers: { 'Content-Type': 'application/json' },
      },
    );
    if (!response.ok) {
      return redirectWith(request, 'channel_error', 'outlook_auth_failed');
    }
  } catch {
    return redirectWith(request, 'channel_error', 'server_error');
  }

  return redirectWith(request, 'channel_connected', 'outlook');
}

function redirectWith(request: NextRequest, key: string, value: string): NextResponse {
  const redirect = new URL('/aiva/workers', getPublicOrigin(request));
  redirect.searchParams.set(key, value);
  return NextResponse.redirect(redirect.toString());
}

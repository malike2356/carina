import { NextRequest, NextResponse } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const error = url.searchParams.get('error') ?? '';

  if (error) {
    return redirectWith(url, 'channel_error', error);
  }

  try {
    const response = await proxyAivaRequest(
      null,
      '/api/aiva/email/oauth/gmail/callback',
      {
        method: 'POST',
        body: JSON.stringify({ code, state }),
        headers: { 'Content-Type': 'application/json' },
      },
    );
    if (!response.ok) {
      return redirectWith(url, 'channel_error', 'gmail_auth_failed');
    }
  } catch {
    return redirectWith(url, 'channel_error', 'server_error');
  }

  return redirectWith(url, 'channel_connected', 'gmail');
}

function redirectWith(url: URL, key: string, value: string): NextResponse {
  const redirect = new URL('/aiva/workers', url.origin);
  redirect.searchParams.set(key, value);
  return NextResponse.redirect(redirect.toString());
}

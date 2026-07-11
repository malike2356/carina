import { NextResponse } from 'next/server';

const SESSION_COOKIE_RE =
  /(?:^|;|,)\s*(?:__Secure-)?better-auth\.session_token=([^;]+)/i;

export function forwardAuthCookies(source: Response, target: NextResponse): void {
  for (const cookie of source.headers.getSetCookie()) {
    target.headers.append('Set-Cookie', cookie);
  }
}

export function extractSessionToken(source: Response): string | null {
  const headerToken = source.headers.get('set-auth-token')?.trim();
  if (headerToken) return headerToken;

  for (const cookie of source.headers.getSetCookie()) {
    const match = cookie.match(SESSION_COOKIE_RE);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

export async function readAuthError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  return data.message ?? data.error ?? 'Authentication failed';
}

export function jsonAuthOk(token: string | null, source: Response, status = 200): NextResponse {
  const body: { ok: true; token?: string } = { ok: true };
  if (token) body.token = token;
  const response = NextResponse.json(body, { status });
  forwardAuthCookies(source, response);
  if (token) {
    response.headers.set('set-auth-token', token);
    response.headers.append('Access-Control-Expose-Headers', 'set-auth-token');
  }
  return response;
}

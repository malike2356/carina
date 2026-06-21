import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveBridgeSecret(): string {
  return (
    process.env.CARINA_TERMINAL_BRIDGE_SECRET?.trim() ||
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    process.env.CARINA_OPS_TOKEN?.trim() ||
    ''
  );
}

function signBridgeToken(payload: Record<string, unknown>): string {
  const secret = resolveBridgeSecret();
  if (!secret) return '';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function resolveCoreWsUrl(): string {
  const coreUrl = process.env.CARINA_CORE_URL?.trim()
    || (process.env.NODE_ENV === 'production' ? 'http://carina-web:3000' : 'http://localhost:3000');
  const url = new URL('/api/terminal/ws', coreUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const token = signBridgeToken({
    kind: 'terminal-bridge',
    userId: session.user.id,
    email: session.user.email,
    workspaceId: workspace.id,
    exp: Date.now() + 5 * 60_000,
  });

  if (!token) {
    return NextResponse.json({ error: 'Terminal bridge secret is not configured.' }, { status: 503 });
  }

  return NextResponse.json({
    data: {
      wsUrl: `${resolveCoreWsUrl()}?token=${encodeURIComponent(token)}`,
      expiresInSeconds: 300,
    },
  });
}

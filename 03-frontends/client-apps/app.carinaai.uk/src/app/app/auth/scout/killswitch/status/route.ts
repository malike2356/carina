import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';

export const dynamic = 'force-dynamic';

async function scoutUpstream(
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<Response> {
  const scoutUrl =
    process.env.LABYRINTH_URL?.trim() ||
    process.env.SCOUT_URL?.trim() ||
    'https://console.labyrinthscout.com';
  return fetch(`${scoutUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Scout-Key': apiKey,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const workspace = await requireWorkspace(session.user.id);
    const keys = await getDecryptedWorkspaceKeys(workspace.id);
    const scoutKey = keys.find((key) => key.provider === 'labyrinth-scout');
    if (!scoutKey?.apiKey) {
      return NextResponse.json(
        { error: 'Scout is not provisioned for this account' },
        { status: 404 },
      );
    }

    const upstream = await scoutUpstream('/api/killswitch/status', scoutKey.apiKey);
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kill switch status failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

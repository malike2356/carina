import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getWorkspaceForUser } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(session.user.id);
  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    tier: workspace?.plan ?? 'free',
    apiKey: null,
    scoutActive: workspace?.plan === 'team' || Boolean(workspace?.scoutPairingAllowed),
    org: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          role: 'owner',
          plan: workspace.plan ?? 'free',
        }
      : null,
  });
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getWorkspaceForUser } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { hosted: true, user: null, installedPacks: [] },
      { status: 401 },
    );
  }

  const workspace = await getWorkspaceForUser(session.user.id);
  const installedPacks = (workspace?.activeSkillPacks ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((packName) => ({
      pack_name: packName,
      version: 'current',
      status: 'active',
    }));

  return NextResponse.json({
    hosted: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      tier: workspace?.plan ?? 'free',
      scoutActive:
        workspace?.plan === 'team' || Boolean(workspace?.scoutPairingAllowed),
    },
    installedPacks,
  });
}

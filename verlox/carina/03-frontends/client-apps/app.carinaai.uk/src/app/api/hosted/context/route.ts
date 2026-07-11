import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract (core hosted-web shape).
 * Returns signed-in user for Carina Cloud accounts (better-auth).
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({
      hosted: true,
      user: null,
      installedPacks: [],
    });
  }

  let tier = 'free';
  try {
    const workspace = await requireWorkspace(session.user.id);
    tier = String((workspace as { plan?: string }).plan ?? 'free');
  } catch {
    // ignore
  }

  return NextResponse.json({
    hosted: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      tier,
      scoutActive: false,
    },
    installedPacks: [],
  });
}

import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  let tier = 'free';
  try {
    const workspace = await requireWorkspace(session.user.id);
    tier = String((workspace as { plan?: string }).plan ?? 'free');
  } catch {
    // workspace may not exist yet during onboarding
  }

  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    tier,
    apiKey: null,
    scoutActive: false,
    org: null,
  });
}

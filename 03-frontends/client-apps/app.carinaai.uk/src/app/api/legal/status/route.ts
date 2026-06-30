import { NextResponse } from 'next/server';
import { getLegalStatus } from '@/lib/legal/acceptance';
import { requireSession, requireWorkspace } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const status = await getLegalStatus(session.user.id, workspace.id);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

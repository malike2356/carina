import { NextResponse } from 'next/server';
import { getUsageTotals } from '@/lib/quota';
import { requireSession, requireWorkspace } from '@/lib/session';

export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const usage = await getUsageTotals(workspace);
    return NextResponse.json({ plan: workspace.plan, ...usage });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

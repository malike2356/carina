import { NextRequest, NextResponse } from 'next/server';
import { buildAdminOpsAnalytics, parseAdminOpsPeriod } from '@/lib/admin-ops-analytics';
import { requireSession, requireWorkspace } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const period = parseAdminOpsPeriod(new URL(request.url).searchParams.get('period'));
    const payload = await buildAdminOpsAnalytics(workspace.id, period);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

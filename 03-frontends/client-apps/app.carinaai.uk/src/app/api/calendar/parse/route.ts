import { NextResponse } from 'next/server';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { parseCalendarEventWithLlm } from '@/lib/calendar-parse';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as { phrase?: string };
  const phrase = String(body.phrase ?? '').trim();
  if (!phrase) return NextResponse.json({ error: 'phrase is required' }, { status: 400 });

  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  const parsed = await parseCalendarEventWithLlm(phrase, keys);
  if (!parsed) {
    return NextResponse.json({ error: 'Could not parse event' }, { status: 422 });
  }

  return NextResponse.json({ data: parsed });
}

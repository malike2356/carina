import { NextResponse } from 'next/server';
import { db } from '@/db';
import { scheduledTasks } from '@/db/schema';
import { createAgentOsDocument } from '@/lib/agent-os-documents';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = (await request.json().catch(() => ({}))) as {
    audience?: string;
    offer?: string;
    channel?: string;
  };
  const audience = String(body.audience ?? '').trim() || 'agency owners';
  const offer = String(body.offer ?? '').trim() || 'a free install review';
  const channel = String(body.channel ?? '').trim() || 'email';
  const title = `Outreach plan: ${audience}`;
  const content = `# ${title}

**Offer:** ${offer}  
**Preferred channel:** ${channel}

## Calendar hooks
- Day 1: introduce problem
- Day 3: share proof
- Day 7: soft ask

## Follow-up sequence
1. Value note
2. Case snippet
3. Ask for 15 minutes

## Gate
No mass-send. Route outbound through approvals / Soft Wall.
`;

  const result = await createAgentOsDocument(title, content);
  if ('error' in result) return result.error;

  const [task] = await db
    .insert(scheduledTasks)
    .values({
      workspaceId: workspace.id,
      name: `Outreach follow-up: ${audience}`,
      description: `Human-reviewed ${channel} sequence for ${offer}`,
      triggerType: 'on_event',
      taskType: 'action',
      status: 'draft',
      prompt: `Prepare a ${channel} follow-up for ${audience} offering ${offer}. Do not send without approval.`,
      builtIn: false,
    })
    .returning();

  return NextResponse.json({
    data: result.document,
    task,
    href: `/documents/${result.document.id}`,
  });
}

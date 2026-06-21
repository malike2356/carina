import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { getSession, requireWorkspace } from '@/lib/session';
import { completeWorkspacePrompt } from '@/lib/workspace-llm';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

const ASSIST_PROMPTS: Record<string, string> = {
  format: 'Fix markdown formatting only. Return the full corrected text with no commentary.',
  spellcheck: 'Fix spelling and grammar only. Return the full corrected text with no commentary.',
  factcheck:
    'Fact-check the text. Return the text with brief inline notes for uncertain claims in [brackets]. Do not invent sources.',
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const workspace = await requireWorkspace(session.user.id);
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.workspaceId, workspace.id)))
    .limit(1);

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as {
    action?: string;
    selection?: string;
    content?: string;
  };
  const action = String(body.action ?? '').trim();
  const instruction = ASSIST_PROMPTS[action];
  if (!instruction) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const source = body.selection?.trim() || body.content?.trim() || doc.content;
  if (!source.trim()) {
    return NextResponse.json({ error: 'Nothing to assist' }, { status: 400 });
  }

  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  if (keys.length === 0) {
    return NextResponse.json({ error: 'No API keys configured' }, { status: 400 });
  }

  try {
    const result = await completeWorkspacePrompt(
      keys,
      'Return only the corrected text. Do not add commentary or markdown fences.',
      `${instruction}\n\nText:\n${source.slice(0, 12000)}`,
    );
    return NextResponse.json({ content: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

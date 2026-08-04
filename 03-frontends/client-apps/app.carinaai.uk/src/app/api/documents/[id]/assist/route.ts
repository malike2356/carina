import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { getSession, requireWorkspace } from '@/lib/session';
import { completeWorkspacePrompt } from '@/lib/workspace-llm';

type RouteContext = { params: Promise<{ id: string }> };
type AssistMode = 'insert' | 'replace';

export const dynamic = 'force-dynamic';

const ASSIST_PROMPTS: Record<string, string> = {
  format:
    'Fix markdown formatting only. Keep all headings (# / ##), lists, links, and paragraph breaks. Return the full corrected markdown with no commentary.',
  spellcheck:
    'Fix spelling and grammar only. Preserve markdown headings, lists, and links. Return the full corrected markdown with no commentary.',
  factcheck:
    'Fact-check the text. Return markdown with brief inline notes for uncertain claims in [brackets]. Keep headings and structure. Do not invent sources.',
  write_next:
    'Write the next paragraph continuing naturally from where the document ends. Match the existing tone, tense, and style. Return only the new paragraph(s) to insert as markdown.',
};

const INSERT_SYSTEM =
  'Return only the new markdown to insert at the cursor. Preserve structure with headings and lists when appropriate. No preamble, commentary, or markdown fences.';

const REPLACE_SYSTEM =
  'Return only the corrected markdown. Preserve document structure (headings, lists, links, paragraphs). Do not add commentary or markdown fences.';

function resolveAssistRequest(body: {
  action?: string;
  instruction?: string;
  mode?: string;
  selection?: string;
  content?: string;
}): { instruction: string; mode: AssistMode } | null {
  const customInstruction = String(body.instruction ?? '').trim();
  if (customInstruction) {
    const mode: AssistMode =
      body.mode === 'insert' || body.mode === 'replace'
        ? body.mode
        : body.selection?.trim()
          ? 'replace'
          : 'insert';
    return { instruction: customInstruction, mode };
  }

  const action = String(body.action ?? '').trim();
  const preset = ASSIST_PROMPTS[action];
  if (!preset) return null;

  return {
    instruction: preset,
    mode: action === 'write_next' ? 'insert' : 'replace',
  };
}

function buildUserPrompt(
  instruction: string,
  mode: AssistMode,
  source: {
    selection?: string;
    content: string;
    title: string;
  },
): string {
  const docBody = source.content.slice(0, 12000);

  if (mode === 'insert') {
    const docContext = docBody.trim() || `(Document title: ${source.title})`;
    return `${instruction}\n\nDocument so far:\n${docContext}`;
  }

  if (source.selection?.trim()) {
    return `${instruction}\n\nSelected text:\n${source.selection}\n\nFull document:\n${docBody}`;
  }

  return `${instruction}\n\nText:\n${docBody}`;
}

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
    instruction?: string;
    mode?: string;
    selection?: string;
    content?: string;
  };

  const resolved = resolveAssistRequest(body);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid action or instruction' }, { status: 400 });
  }

  const { instruction, mode } = resolved;
  const selection = body.selection?.trim();
  const content = body.content?.trim() ?? doc.content;
  const sourceText = selection || content;

  if (mode === 'replace' && !sourceText.trim()) {
    return NextResponse.json({ error: 'Nothing to assist' }, { status: 400 });
  }

  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  if (keys.length === 0) {
    return NextResponse.json({ error: 'No API keys configured' }, { status: 400 });
  }

  try {
    const result = await completeWorkspacePrompt(
      keys,
      mode === 'insert' ? INSERT_SYSTEM : REPLACE_SYSTEM,
      buildUserPrompt(instruction, mode, {
        selection,
        content,
        title: doc.title,
      }),
    );
    return NextResponse.json({ content: result, mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

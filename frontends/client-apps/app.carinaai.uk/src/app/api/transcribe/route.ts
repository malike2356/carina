import { NextResponse } from 'next/server';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { getSession, requireWorkspace } from '@/lib/session';
import { transcribeWorkspaceAudio } from '@/lib/transcribe-audio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const contentType = req.headers.get('content-type') ?? 'audio/webm';
  const language = req.headers.get('x-transcribe-lang') ?? 'en';

  const buf = Buffer.from(await req.arrayBuffer());
  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  const result = await transcribeWorkspaceAudio(keys, buf, contentType, language);

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ data: { text: result.text, provider: result.provider } });
}

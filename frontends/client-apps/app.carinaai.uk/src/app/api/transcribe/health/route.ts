import { NextResponse } from 'next/server';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { probeVoiceTranscriptionCapabilities } from '@/lib/transcribe-audio';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  const capabilities = await probeVoiceTranscriptionCapabilities(keys);

  return NextResponse.json({
    data: {
      serverTranscription: capabilities.serverTranscription,
      platformWhisper: capabilities.platformWhisper,
      localWhisper: capabilities.localWhisper,
      coreReachable: capabilities.coreReachable,
      appLocalWhisper: capabilities.appLocalWhisper,
      sources: capabilities.sources,
      tiers: capabilities.tiers,
      primarySource: capabilities.primarySource,
    },
  });
}

import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const workspace = await requireWorkspace(session.user.id);
  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  const scoutKey = keys.find((key) => key.provider === 'labyrinth-scout');
  if (!scoutKey?.apiKey) {
    return NextResponse.json(
      { error: 'Scout is not provisioned for this account' },
      { status: 404 },
    );
  }

  const envSnippet = [
    `LABYRINTH_SCOUT_KEY=${scoutKey.apiKey}`,
    `LABYRINTH_INSTANCE_ID=${workspace.id}`,
  ].join('\n');

  return NextResponse.json({
    apiKey: scoutKey.apiKey,
    instanceId: workspace.id,
    envSnippet,
  });
}

import { NextResponse } from 'next/server';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import {
  getWorkspaceDefaultProvider,
  listConfiguredProviders,
  resolveActiveCloudProvider,
} from '@/lib/cloud-chat-provider';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  const providers = listConfiguredProviders(keys);
  const preferred = await getWorkspaceDefaultProvider(workspace.id);
  const active = resolveActiveCloudProvider(keys, preferred);

  return NextResponse.json({
    providers,
    active,
    preferred: preferred || null,
  });
}

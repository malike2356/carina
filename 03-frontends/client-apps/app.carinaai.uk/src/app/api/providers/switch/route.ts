import { NextResponse } from 'next/server';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import {
  isCloudChatProvider,
  listConfiguredProviders,
  resolveActiveCloudProvider,
  setWorkspaceDefaultProvider,
} from '@/lib/cloud-chat-provider';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { provider?: string };
  const provider = String(body.provider ?? '').trim();
  if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

  const workspace = await requireWorkspace(session.user.id);
  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  const providers = listConfiguredProviders(keys);

  if (!providers.includes(provider)) {
    return NextResponse.json({ error: 'Provider is not configured for this workspace.' }, { status: 404 });
  }
  if (!isCloudChatProvider(provider)) {
    return NextResponse.json(
      { error: `Provider ${provider} is not supported for cloud chat yet.` },
      { status: 400 },
    );
  }

  await setWorkspaceDefaultProvider(workspace.id, provider);
  const active = resolveActiveCloudProvider(keys, provider);

  return NextResponse.json({
    ok: true,
    active,
    preferred: provider,
    providers,
  });
}

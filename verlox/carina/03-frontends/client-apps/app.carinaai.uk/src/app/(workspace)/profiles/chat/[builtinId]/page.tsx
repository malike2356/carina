import { redirect } from 'next/navigation';
import { isBuiltinWorkspaceProfileId } from '@/lib/builtin-workspace-profiles';
import { createBuiltinProfileChatSession } from '@/lib/support-chat';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ builtinId: string }>;
}

export default async function BuiltinProfileChatPage({ params }: Props) {
  const { builtinId } = await params;
  if (!isBuiltinWorkspaceProfileId(builtinId)) {
    redirect('/profiles');
  }

  const session = await getSession();
  if (!session) redirect('/login');

  const workspace = await requireWorkspace(session.user.id);

  try {
    const sessionId = await createBuiltinProfileChatSession(workspace.id, builtinId);
    redirect(`/chat/${sessionId}`);
  } catch {
    redirect('/profiles');
  }
}

import { redirect } from 'next/navigation';
import { createSupportChatSession } from '@/lib/support-chat';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function SupportChatPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const workspace = await requireWorkspace(session.user.id);

  try {
    const sessionId = await createSupportChatSession(workspace.id);
    redirect(`/chat/${sessionId}`);
  } catch {
    redirect('/chat');
  }
}

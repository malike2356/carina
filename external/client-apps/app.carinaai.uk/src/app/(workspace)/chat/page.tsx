import { redirect } from 'next/navigation';
import { getOrCreateSession } from '@/lib/chat-sessions';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ChatIndexPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const workspace = await requireWorkspace(session.user.id);
  const sessionId = await getOrCreateSession(workspace.id, null);
  redirect(`/chat/${sessionId}`);
}

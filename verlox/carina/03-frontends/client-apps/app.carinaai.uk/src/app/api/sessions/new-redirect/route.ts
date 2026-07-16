import { redirect } from 'next/navigation';
import { getOrCreateSession } from '@/lib/chat-sessions';
import { getSession, requireWorkspace } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) redirect('/login');
  const workspace = await requireWorkspace(session.user.id);
  const id = await getOrCreateSession(workspace.id, null);
  redirect(`/chat/${id}`);
}

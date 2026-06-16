import Link from 'next/link';
import { Plus } from 'lucide-react';
import { redirect } from 'next/navigation';
import { listSessions } from '@/lib/chat-sessions';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const workspace = await requireWorkspace(session.user.id);
  const sessions = await listSessions(workspace.id, 1);

  if (sessions.length > 0) {
    redirect(`/chat/${sessions[0].id}`);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Welcome to Carina</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Your AI property assistant. Start a conversation to get to work.
        </p>
      </div>
      <Link
        href="/api/sessions/new-redirect"
        className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent-hover transition-colors"
      >
        <Plus className="h-4 w-4" />
        Start first chat
      </Link>
    </div>
  );
}

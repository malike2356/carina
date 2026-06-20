import { redirect } from 'next/navigation';
import { count, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { userMemories, workspaceSkills, byokKeys, scheduledTasks } from '@/db/schema';
import { listSessions } from '@/lib/chat-sessions';
import { getSession, requireWorkspace } from '@/lib/session';
import { LauncherExpanded } from '@/components/launcher/LauncherExpanded';

export const dynamic = 'force-dynamic';

export default async function LauncherPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const workspace = await requireWorkspace(session.user.id);
  const wid = workspace.id;

  const [sessions, memoriesRes, skillsRes, keysRes, tasksRes] = await Promise.all([
    listSessions(wid, 50),
    db.select({ n: count() }).from(userMemories).where(and(eq(userMemories.workspaceId, wid), eq(userMemories.enabled, true))),
    db.select({ n: count() }).from(workspaceSkills).where(and(eq(workspaceSkills.workspaceId, wid), eq(workspaceSkills.enabled, true))),
    db.select({ n: count() }).from(byokKeys).where(eq(byokKeys.workspaceId, wid)),
    db.select({ n: count() }).from(scheduledTasks).where(eq(scheduledTasks.workspaceId, wid)),
  ]);

  return (
    <LauncherExpanded
      userName={session.user.name ?? session.user.email ?? 'there'}
      userEmail={session.user.email ?? ''}
      sessions={sessions.slice(0, 6)}
      totalSessions={sessions.length}
      latestSessionId={sessions[0]?.id ?? null}
      memoryCount={memoriesRes[0]?.n ?? 0}
      skillCount={skillsRes[0]?.n ?? 0}
      keyCount={keysRes[0]?.n ?? 0}
      taskCount={tasksRes[0]?.n ?? 0}
    />
  );
}

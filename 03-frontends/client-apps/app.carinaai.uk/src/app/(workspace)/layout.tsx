import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { WindowWorkspaceShell } from '@/components/windows/WindowWorkspaceShell';
import { WorkspaceLayoutClient } from '@/components/shell/WorkspaceLayoutClient';
import { ThemeSwitcherHost } from '@/components/shell/ThemeSwitcherHost';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <WindowWorkspaceShell>
      <WorkspaceLayoutClient
        userEmail={session.user.email}
        userName={session.user.name ?? ''}
      >
        {children}
      </WorkspaceLayoutClient>
      <ThemeSwitcherHost />
    </WindowWorkspaceShell>
  );
}

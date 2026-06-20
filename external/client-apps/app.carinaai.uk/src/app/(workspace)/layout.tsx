import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { GlobalShortcuts } from '@/components/shell/GlobalShortcuts';
import { PanelProvider } from '@/components/shell/PanelProvider';
import { ShortcutsPanel } from '@/components/shell/ShortcutsPanel';
import { KeysBanner } from '@/components/shell/KeysBanner';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-base text-text-primary">
      <AppSidebar userEmail={session.user.email} userName={session.user.name ?? ''} />
      <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <KeysBanner />
        <PanelProvider>{children}</PanelProvider>
      </main>
      <CommandPalette />
      <GlobalShortcuts />
      <ShortcutsPanel />
    </div>
  );
}

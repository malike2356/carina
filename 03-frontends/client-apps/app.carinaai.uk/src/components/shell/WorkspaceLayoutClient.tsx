'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { GlobalShortcuts } from '@/components/shell/GlobalShortcuts';
import { PanelProvider } from '@/components/shell/PanelProvider';
import { ShortcutsPanel } from '@/components/shell/ShortcutsPanel';
import { KeysBanner } from '@/components/shell/KeysBanner';
import { MobileBottomNav } from '@/components/shell/MobileBottomNav';
import { MobileWorkspaceHeader } from '@/components/shell/MobileWorkspaceHeader';
import { CanvasSidePanel } from '@/components/canvas/CanvasSidePanel';
import { CanvasPanelProvider } from '@/lib/canvas-panel';
import { AppProviders } from '@/components/shell/AppProviders';
import { LegalGate } from '@/components/legal/LegalGate';
import { AskCarinaWidget } from '@/components/carina-help/AskCarinaWidget';
import { WorkspaceTopBar } from '@/components/shell/WorkspaceTopBar';
import { isWorkspaceFullBleedPath } from '@/lib/page-shell';

type WorkspaceLayoutClientProps = {
  children: ReactNode;
  userEmail: string;
  userName: string;
};

export function WorkspaceLayoutClient({ children, userEmail, userName }: WorkspaceLayoutClientProps) {
  const pathname = usePathname();
  const fullBleed = isWorkspaceFullBleedPath(pathname);

  return (
    <AppProviders>
      <LegalGate>
        <CanvasPanelProvider>
          <div className="flex h-[100dvh] max-w-[100vw] overflow-hidden bg-base text-text-primary carina-workspace-shell">
            <AppSidebar userEmail={userEmail} userName={userName} />
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <MobileWorkspaceHeader userEmail={userEmail} userName={userName} />
              <KeysBanner />
              <WorkspaceTopBar userEmail={userEmail} userName={userName} />
              <PanelProvider>
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
                    {fullBleed ? (
                      <div
                        className="workspace-page-fullbleed flex min-h-0 w-full min-w-0 max-w-none flex-1 flex-col"
                        style={{ width: '100%', maxWidth: 'none' }}
                      >
                        {children}
                      </div>
                    ) : (
                      children
                    )}
                  </div>
                  <CanvasSidePanel />
                </div>
              </PanelProvider>
            </main>
            <MobileBottomNav />
            <CommandPalette />
            <GlobalShortcuts />
            <ShortcutsPanel />
            <AskCarinaWidget />
          </div>
        </CanvasPanelProvider>
      </LegalGate>
    </AppProviders>
  );
}

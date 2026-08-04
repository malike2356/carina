'use client';

import type { ReactNode } from 'react';
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

type WorkspaceLayoutClientProps = {
  children: ReactNode;
  userEmail: string;
  userName: string;
};

export function WorkspaceLayoutClient({ children, userEmail, userName }: WorkspaceLayoutClientProps) {
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
                    {children}
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

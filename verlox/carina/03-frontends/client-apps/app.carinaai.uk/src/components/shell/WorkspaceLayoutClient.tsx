'use client';

import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { GlobalShortcuts } from '@/components/shell/GlobalShortcuts';
import { PanelProvider } from '@/components/shell/PanelProvider';
import { ShortcutsPanel } from '@/components/shell/ShortcutsPanel';
import { KeysBanner } from '@/components/shell/KeysBanner';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { CanvasSidePanel } from '@/components/canvas/CanvasSidePanel';
import { CanvasPanelProvider } from '@/lib/canvas-panel';
import { AppProviders } from '@/components/shell/AppProviders';
import { LegalGate } from '@/components/legal/LegalGate';

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
          <div className="flex h-screen overflow-hidden bg-base text-text-primary carina-workspace-shell">
            <AppSidebar userEmail={userEmail} userName={userName} />
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <KeysBanner />
              <Breadcrumb />
              <PanelProvider>
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
                  <CanvasSidePanel />
                </div>
              </PanelProvider>
            </main>
            <CommandPalette />
            <GlobalShortcuts />
            <ShortcutsPanel />
          </div>
        </CanvasPanelProvider>
      </LegalGate>
    </AppProviders>
  );
}

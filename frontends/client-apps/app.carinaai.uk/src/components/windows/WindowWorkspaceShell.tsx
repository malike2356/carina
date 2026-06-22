'use client';

import { WindowManagerProvider } from '@/lib/window-manager/WindowManagerContext';
import { WorkspaceWindows } from '@/components/windows/WorkspaceWindows';

export function WindowWorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <WindowManagerProvider>
      {children}
      <WorkspaceWindows />
    </WindowManagerProvider>
  );
}

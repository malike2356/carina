'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { MemoryPanel } from '@/components/panels/MemoryPanel';
import { NotesPanel } from '@/components/panels/NotesPanel';
import { SkillsPanel } from '@/components/panels/SkillsPanel';
import { Spinner } from '@/components/ui/Spinner';
import { useContextPins } from '@/components/shell/PanelProvider';
import { useWindowManager } from '@/lib/window-manager/WindowManagerContext';
import type { WorkspaceWindowId } from '@/lib/window-manager/types';

const TasksPage = dynamic(() => import('@/app/(workspace)/tasks/page'), { ssr: false });
const CalendarPage = dynamic(() => import('@/app/(workspace)/calendar/page'), { ssr: false });
const DocumentsPage = dynamic(() => import('@/app/(workspace)/documents/page'), { ssr: false });
const ResearchPage = dynamic(() => import('@/app/(workspace)/research/page'), { ssr: false });
const LibraryPage = dynamic(() => import('@/app/(workspace)/library/page'), { ssr: false });
const EmailPage = dynamic(() => import('@/app/(workspace)/email/page'), { ssr: false });
const SettingsPage = dynamic(() => import('@/app/(workspace)/settings/page'), { ssr: false });
// Compat: window id `files` opens Document Vault (prompt 715). Legacy FilesPage remains importable for soak.
const McpPage = dynamic(() => import('@/components/mcp/McpPage').then((m) => ({ default: m.McpPage })), {
  ssr: false,
});
const CronPage = dynamic(() => import('@/components/cron/CronPage').then((m) => ({ default: m.CronPage })), {
  ssr: false,
});
const EnvironmentPage = dynamic(
  () => import('@/components/environment/EnvironmentPage').then((m) => ({ default: m.EnvironmentPage })),
  { ssr: false },
);
const AnalyticsDashboard = dynamic(
  () => import('@/components/analytics/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })),
  { ssr: false },
);
const LogsPage = dynamic(() => import('@/components/logs/LogsPage').then((m) => ({ default: m.LogsPage })), {
  ssr: false,
});
const ProfilesManager = dynamic(
  () => import('@/components/profiles/ProfilesManager').then((m) => ({ default: m.ProfilesManager })),
  { ssr: false },
);
const WebhooksManager = dynamic(
  () => import('@/components/webhooks/WebhooksManager').then((m) => ({ default: m.WebhooksManager })),
  { ssr: false },
);
const SecurityDashboardClient = dynamic(
  () => import('@/components/security/SecurityDashboardClient').then((m) => ({ default: m.SecurityDashboardClient })),
  { ssr: false },
);
const Terminal = dynamic(() => import('@/components/terminal/Terminal').then((m) => ({ default: m.Terminal })), {
  ssr: false,
});
const BillingWindowContent = dynamic(
  () => import('@/components/billing/BillingWindowContent').then((m) => ({ default: m.BillingWindowContent })),
  { ssr: false },
);

function LoadingBody() {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center">
      <Spinner />
    </div>
  );
}

function PanelWindowContent({ windowId }: { windowId: WorkspaceWindowId }) {
  const { closeWindow } = useWindowManager();
  const params = useParams<{ sessionId?: string }>();
  const contextPins = useContextPins();
  const onClose = () => closeWindow(windowId);

  if (windowId === 'memory') {
    return <MemoryPanel onClose={onClose} embedded />;
  }
  if (windowId === 'skills') {
    return <SkillsPanel onClose={onClose} embedded />;
  }
  if (windowId === 'notes') {
    return (
      <NotesPanel
        onClose={onClose}
        embedded
        activeSessionId={params?.sessionId ?? null}
        pinnedNoteIds={contextPins?.pinnedNoteIds}
        onPinToggle={contextPins?.onPinToggle}
      />
    );
  }
  if (windowId === 'terminal') {
    return <Terminal mode="page" onClose={onClose} />;
  }
  return null;
}

export function WindowContent({ windowId }: { windowId: WorkspaceWindowId }) {
  if (windowId === 'memory' || windowId === 'skills' || windowId === 'notes' || windowId === 'terminal') {
    return <PanelWindowContent windowId={windowId} />;
  }

  return (
    <Suspense fallback={<LoadingBody />}>
      <WindowRouteContent windowId={windowId} />
    </Suspense>
  );
}

function WindowRouteContent({ windowId }: { windowId: WorkspaceWindowId }) {
  switch (windowId) {
    case 'tasks':
      return <TasksPage />;
    case 'calendar':
      return <CalendarPage />;
    case 'documents':
      return <DocumentsPage />;
    case 'research':
      return <ResearchPage />;
    case 'library':
      return <LibraryPage />;
    case 'email':
      return <EmailPage />;
    case 'settings':
      return <SettingsPage />;
    case 'files':
      return <DocumentsPage />;
    case 'mcp':
      return <McpPage />;
    case 'cron':
      return <CronPage />;
    case 'env':
      return <EnvironmentPage />;
    case 'analytics':
      return <AnalyticsDashboard embedded />;
    case 'logs':
      return <LogsPage />;
    case 'profiles':
      return <ProfilesManager />;
    case 'webhooks':
      return <WebhooksManager />;
    case 'security':
      return <SecurityDashboardClient />;
    case 'billing':
      return <BillingWindowContent />;
    case 'scheduled':
      return <TasksPage />;
    default:
      return null;
  }
}

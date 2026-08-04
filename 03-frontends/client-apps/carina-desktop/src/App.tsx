import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { $gatewayStatus, startHealthPolling } from './store/connection.js';
import { $currentSessionId } from './store/session.js';
import { $killSwitchActive, $killSwitchReason } from './store/carina.js';
import AppSidebar, { type SidebarMode } from './components/layout/AppSidebar.js';
import LauncherPage from './app/launcher/page.js';
import ChatPage from './app/chat/ChatPage.js';
import WorkspacePage from './app/workspace/page.js';
import SettingsLayout from './app/settings/layout.js';
import ModelsSettingsPage from './app/settings/models/page.js';
import ChannelsSettingsPage from './app/settings/channels/page.js';
import AppearanceSettingsPage from './app/settings/appearance/page.js';
import DevicesSettingsPage from './app/settings/devices/page.js';
import AboutSettingsPage from './app/settings/about/page.js';
import CanvasPage from './app/canvas/page.js';
import EventsPage from './app/events/page.js';
import ScoutReportPage from './app/scout/page.js';
import OperatorPage from './app/operator/page.js';
import { useChatStream } from './hooks/use-chat-stream.js';
import { useSessionActions } from './hooks/use-session-actions.js';
import { applyAppearance, loadAppearance } from './lib/appearance.js';
import { openEventMonitorWindow } from './lib/event-monitor-window.js';
import { setupDeepLinks } from './lib/deep-links.js';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './lib/shortcuts.js';
import { completePairing, installSkill } from './lib/gateway-client.js';
import { NAV_ITEMS, ROUTES } from './lib/router-paths.js';
import { useTraySync } from './hooks/use-tray-sync.js';
import { useUpdater } from './hooks/use-updater.js';
import UpdateBanner from './components/layout/UpdateBanner.js';
import { startCarinaPolling } from './lib/carina-poller.js';
import { useOfflineSync } from './hooks/use-offline-sync.js';

const SIDEBAR_MODE_KEY = 'carina_sidebar_mode';

function loadSidebarMode(): SidebarMode {
  const saved = localStorage.getItem(SIDEBAR_MODE_KEY);
  if (saved === 'collapsed' || saved === 'wide') return saved;
  return 'normal';
}

function Shell() {
  const gatewayStatus = useStore($gatewayStatus);
  const currentSessionId = useStore($currentSessionId);
  const killSwitchActive = useStore($killSwitchActive);
  const killSwitchReason = useStore($killSwitchReason);
  const { createNewSession, selectSession } = useSessionActions();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(loadSidebarMode);

  useChatStream();
  useTraySync(gatewayStatus === 'down');
  const { syncNow } = useOfflineSync();
  const updater = useUpdater();
  const offline = gatewayStatus === 'down';

  useEffect(() => {
    startHealthPolling();
    applyAppearance(loadAppearance());
    void registerGlobalShortcuts();
    const stopPolling = startCarinaPolling();

    let stopDeepLinks: (() => void) | undefined;
    void setupDeepLinks({
      navigate: (path) => navigate(path.startsWith('/') ? path : `/${path}`),
      selectSession: (sessionId) => selectSession(sessionId),
      createSession: () => void createNewSession(),
      installSkill: (name) => installSkill(name),
      completePairing: (token) => completePairing(token),
    }).then((stop) => {
      stopDeepLinks = stop;
    });

    return () => {
      stopDeepLinks?.();
      stopPolling();
      void unregisterGlobalShortcuts();
    };
  }, [createNewSession, navigate, selectSession]);

  useEffect(() => {
    if (!currentSessionId && !offline && location.pathname === ROUTES.chat) {
      navigate(ROUTES.launcher, { replace: true });
    }
  }, [currentSessionId, offline, location.pathname, navigate]);

  const ensureSession = useCallback(() => {
    void createNewSession();
  }, [createNewSession]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey) return;
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        void openEventMonitorWindow();
        return;
      }
      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        navigate(ROUTES.operator);
        return;
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        navigate(ROUTES.scout);
        return;
      }
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setSidebarMode((current) => {
          const next: SidebarMode = event.shiftKey
            ? (current === 'wide' ? 'normal' : 'wide')
            : (current === 'collapsed' ? 'normal' : 'collapsed');
          localStorage.setItem(SIDEBAR_MODE_KEY, next);
          return next;
        });
        return;
      }
      const item = NAV_ITEMS.find((entry) => entry.shortcut === event.key);
      if (item) {
        event.preventDefault();
        navigate(item.route);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  if (location.pathname === ROUTES.launcher) {
    return <LauncherPage />;
  }
  if (location.pathname === ROUTES.canvas || location.pathname.endsWith('/canvas')) {
    return <CanvasPage />;
  }
  if (location.pathname === ROUTES.events) {
    return <EventsPage />;
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans flex-col">
      {updater.update && (
        <UpdateBanner
          version={updater.update.version}
          body={updater.update.body}
          onInstall={() => void updater.install()}
          onDismiss={updater.dismiss}
        />
      )}
      {offline && (
        <div className="bg-amber-950 border-b border-amber-800 px-4 py-2 text-sm text-amber-100">
          Gateway offline. Cached sessions and memories remain available; new messages queue until reconnect.
        </div>
      )}
      {killSwitchActive && (
        <div className="bg-red-950 border-b border-red-800 px-4 py-2 text-sm text-red-200">
          KILL SWITCH ACTIVE: {killSwitchReason || 'Carina is suspended by Scout'}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          mode={sidebarMode}
          onSelectSession={selectSession}
          onCreateSession={() => void createNewSession()}
          onSyncNow={() => void syncNow()}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path={ROUTES.chat} element={<ChatPage onNeedSession={ensureSession} />} />
              <Route path={ROUTES.workspace} element={<WorkspacePage />} />
              <Route path={ROUTES.agents} element={<Navigate to={`${ROUTES.workspace}?tab=agents`} replace />} />
              <Route path={ROUTES.artifacts} element={<Navigate to={`${ROUTES.workspace}?tab=artifacts`} replace />} />
              <Route path={ROUTES.sessions} element={<Navigate to={`${ROUTES.workspace}?tab=sessions`} replace />} />
              <Route path={ROUTES.skills} element={<Navigate to={`${ROUTES.workspace}?tab=skills`} replace />} />
              <Route path={ROUTES.scout} element={<ScoutReportPage />} />
              <Route path={ROUTES.operator} element={<OperatorPage />} />
              <Route path={ROUTES.settings} element={<SettingsLayout />}>
                <Route index element={<Navigate to={ROUTES.settingsModels} replace />} />
                <Route path="models" element={<ModelsSettingsPage />} />
                <Route path="channels" element={<ChannelsSettingsPage />} />
                <Route path="appearance" element={<AppearanceSettingsPage />} />
                <Route path="devices" element={<DevicesSettingsPage />} />
                <Route path="about" element={<AboutSettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to={ROUTES.chat} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

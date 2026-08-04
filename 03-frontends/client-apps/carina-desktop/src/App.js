import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { $gatewayStatus, startHealthPolling } from './store/connection.js';
import { $currentSessionId } from './store/session.js';
import { $killSwitchActive, $killSwitchReason } from './store/carina.js';
import AppSidebar from './components/layout/AppSidebar.js';
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
function loadSidebarMode() {
    const saved = localStorage.getItem(SIDEBAR_MODE_KEY);
    if (saved === 'collapsed' || saved === 'wide')
        return saved;
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
    const [sidebarMode, setSidebarMode] = useState(loadSidebarMode);
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
        let stopDeepLinks;
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
        function onKeyDown(event) {
            if (!event.ctrlKey)
                return;
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
                    const next = event.shiftKey
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
        return _jsx(LauncherPage, {});
    }
    if (location.pathname === ROUTES.canvas || location.pathname.endsWith('/canvas')) {
        return _jsx(CanvasPage, {});
    }
    if (location.pathname === ROUTES.events) {
        return _jsx(EventsPage, {});
    }
    return (_jsxs("div", { className: "flex h-screen bg-zinc-950 text-zinc-100 font-sans flex-col", children: [updater.update && (_jsx(UpdateBanner, { version: updater.update.version, body: updater.update.body, onInstall: () => void updater.install(), onDismiss: updater.dismiss })), offline && (_jsx("div", { className: "bg-amber-950 border-b border-amber-800 px-4 py-2 text-sm text-amber-100", children: "Gateway offline. Cached sessions and memories remain available; new messages queue until reconnect." })), killSwitchActive && (_jsxs("div", { className: "bg-red-950 border-b border-red-800 px-4 py-2 text-sm text-red-200", children: ["KILL SWITCH ACTIVE: ", killSwitchReason || 'Carina is suspended by Scout'] })), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsx(AppSidebar, { mode: sidebarMode, onSelectSession: selectSession, onCreateSession: () => void createNewSession(), onSyncNow: () => void syncNow() }), _jsx("main", { className: "flex-1 flex flex-col overflow-hidden", children: _jsxs(Routes, { children: [_jsx(Route, { path: ROUTES.chat, element: _jsx(ChatPage, { onNeedSession: ensureSession }) }), _jsx(Route, { path: ROUTES.workspace, element: _jsx(WorkspacePage, {}) }), _jsx(Route, { path: ROUTES.agents, element: _jsx(Navigate, { to: `${ROUTES.workspace}?tab=agents`, replace: true }) }), _jsx(Route, { path: ROUTES.artifacts, element: _jsx(Navigate, { to: `${ROUTES.workspace}?tab=artifacts`, replace: true }) }), _jsx(Route, { path: ROUTES.sessions, element: _jsx(Navigate, { to: `${ROUTES.workspace}?tab=sessions`, replace: true }) }), _jsx(Route, { path: ROUTES.skills, element: _jsx(Navigate, { to: `${ROUTES.workspace}?tab=skills`, replace: true }) }), _jsx(Route, { path: ROUTES.scout, element: _jsx(ScoutReportPage, {}) }), _jsx(Route, { path: ROUTES.operator, element: _jsx(OperatorPage, {}) }), _jsxs(Route, { path: ROUTES.settings, element: _jsx(SettingsLayout, {}), children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: ROUTES.settingsModels, replace: true }) }), _jsx(Route, { path: "models", element: _jsx(ModelsSettingsPage, {}) }), _jsx(Route, { path: "channels", element: _jsx(ChannelsSettingsPage, {}) }), _jsx(Route, { path: "appearance", element: _jsx(AppearanceSettingsPage, {}) }), _jsx(Route, { path: "devices", element: _jsx(DevicesSettingsPage, {}) }), _jsx(Route, { path: "about", element: _jsx(AboutSettingsPage, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: ROUTES.chat, replace: true }) })] }) })] })] }));
}
export default function App() {
    return (_jsx(HashRouter, { children: _jsx(Shell, {}) }));
}

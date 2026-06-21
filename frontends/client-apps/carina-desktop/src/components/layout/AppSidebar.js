import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $sessions, $currentSessionId, $sessionLoading } from '../../store/session.js';
import { $gatewayStatus } from '../../store/connection.js';
import { $billingSessions, $killSwitchActive, $plan, $scoutConnected, $scoutUrl, $securityEvents, $trustScore, $usageThisPeriod, $killSwitchReason, } from '../../store/carina.js';
import { NAV_ITEMS, ROUTES } from '../../lib/router-paths.js';
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher.js';
import ScoutWidget from '../scout/ScoutWidget.js';
import UsagePanel from '../billing/UsagePanel.js';
import { getWorkspaces } from '../../lib/gateway-client.js';
import { $workspaces, $activeWorkspace } from '../../store/carina.js';
const MODE_WIDTH = {
    collapsed: 'w-14',
    normal: 'w-64',
    wide: 'w-80',
};
export default function AppSidebar({ mode, onSelectSession, onCreateSession, onRefreshWorkspaces }) {
    const sessions = useStore($sessions);
    const currentId = useStore($currentSessionId);
    const status = useStore($gatewayStatus);
    const loading = useStore($sessionLoading);
    const trustScore = useStore($trustScore);
    const securityEvents = useStore($securityEvents);
    const killSwitchActive = useStore($killSwitchActive);
    const killSwitchReason = useStore($killSwitchReason);
    const scoutConnected = useStore($scoutConnected);
    const scoutUrl = useStore($scoutUrl);
    const plan = useStore($plan);
    const usage = useStore($usageThisPeriod);
    const billingSessions = useStore($billingSessions);
    const [query, setQuery] = useState('');
    const [scoutExpanded, setScoutExpanded] = useState(false);
    const [usageExpanded, setUsageExpanded] = useState(false);
    const navigate = useNavigate();
    const collapsed = mode === 'collapsed';
    const filteredSessions = useMemo(() => {
        const trimmed = query.trim().toLowerCase();
        if (!trimmed)
            return sessions;
        return sessions.filter((s) => (s.title ?? s.sessionId).toLowerCase().includes(trimmed));
    }, [query, sessions]);
    async function refreshWorkspaces() {
        const data = await getWorkspaces();
        $workspaces.set(data.workspaces);
        $activeWorkspace.set(data.workspaces.find((w) => w.id === data.activeId) ?? null);
        onRefreshWorkspaces?.();
    }
    useEffect(() => {
        if (mode === 'wide') {
            setScoutExpanded(true);
            setUsageExpanded(true);
        }
    }, [mode]);
    return (_jsxs("aside", { className: `${MODE_WIDTH[mode]} flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all`, children: [_jsxs("div", { className: "p-3 border-b border-zinc-800 space-y-2", children: [!collapsed ? (_jsx(WorkspaceSwitcher, { onSwitched: () => void refreshWorkspaces() })) : (_jsx("div", { className: "flex justify-center", children: _jsx(WorkspaceSwitcher, { compact: true, onSwitched: () => void refreshWorkspaces() }) })), !collapsed && (_jsxs("span", { className: `text-[10px] ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`, children: ["Gateway ", status] }))] }), _jsx("nav", { className: "p-2 space-y-1 border-b border-zinc-800", children: NAV_ITEMS.map((item) => (_jsxs(NavLink, { to: item.route, end: item.route === ROUTES.chat, title: item.label, className: ({ isActive }) => `block ${collapsed ? 'px-2 py-2 text-center' : 'px-3 py-2'} rounded text-sm ${isActive ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'}`, children: [collapsed ? item.label.slice(0, 1) : item.label, !collapsed && _jsxs("span", { className: "float-right text-[10px] text-zinc-600", children: ["Ctrl+", item.shortcut] })] }, item.route))) }), !collapsed && (_jsxs("div", { className: "p-3 border-b border-zinc-800 space-y-2", children: [_jsx("button", { type: "button", onClick: () => {
                            void onCreateSession();
                            navigate(ROUTES.chat);
                        }, className: "w-full px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg", children: "New session" }), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search sessions", className: "w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600" })] })), _jsxs("nav", { className: "flex-1 overflow-y-auto p-2 space-y-1", children: [loading && !collapsed && _jsx("p", { className: "text-xs text-zinc-500 px-2 py-1", children: "Loading sessions..." }), !loading && filteredSessions.length === 0 && !collapsed && (_jsx("p", { className: "text-xs text-zinc-500 px-2 py-1", children: "No sessions yet" })), filteredSessions.map((s) => (_jsx("button", { type: "button", title: s.title ?? s.sessionId, onClick: () => {
                            onSelectSession(s.sessionId);
                            navigate(ROUTES.chat);
                        }, className: `w-full text-left ${collapsed ? 'px-1 py-2 text-center' : 'px-3 py-2'} rounded text-sm truncate ${s.sessionId === currentId
                            ? 'bg-zinc-700 text-zinc-100'
                            : 'text-zinc-400 hover:bg-zinc-800'}`, children: collapsed ? (s.title ?? s.sessionId).slice(0, 1) : (s.title ?? s.sessionId.slice(0, 12)) }, s.sessionId)))] }), _jsxs("div", { className: "p-2 border-t border-zinc-800 space-y-2", children: [_jsx(ScoutWidget, { score: trustScore, events: securityEvents, killSwitchActive: killSwitchActive, killSwitchReason: killSwitchReason, scoutConnected: scoutConnected, scoutUrl: scoutUrl, expanded: scoutExpanded || mode === 'wide', compact: collapsed, onToggle: () => setScoutExpanded((value) => !value), onOpenReport: () => navigate(ROUTES.scout) }), _jsx(UsagePanel, { planName: plan?.name ?? 'Free', creditsRemaining: usage?.creditsRemaining ?? 0, tokensUsed: usage?.tokensUsed ?? 0, tokenLimit: usage?.tokenLimit ?? 100_000, messagesSent: usage?.messagesSent ?? 0, sessions: billingSessions, expanded: usageExpanded || mode === 'wide', compact: collapsed, onToggle: () => setUsageExpanded((value) => !value), onUpgrade: () => window.open('https://app.carinaai.uk/billing', '_blank') })] })] }));
}

import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $sessions, $currentSessionId, $sessionLoading } from '../../store/session.js';
import { $gatewayStatus } from '../../store/connection.js';
import {
  $billingSessions,
  $killSwitchActive,
  $plan,
  $scoutConnected,
  $scoutUrl,
  $securityEvents,
  $trustScore,
  $usageThisPeriod,
  $killSwitchReason,
} from '../../store/carina.js';
import { NAV_ITEMS, ROUTES } from '../../lib/router-paths.js';
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher.js';
import ScoutWidget from '../scout/ScoutWidget.js';
import UsagePanel from '../billing/UsagePanel.js';
import { getWorkspaces } from '../../lib/gateway-client.js';
import { $workspaces, $activeWorkspace } from '../../store/carina.js';

export type SidebarMode = 'collapsed' | 'normal' | 'wide';

const MODE_WIDTH: Record<SidebarMode, string> = {
  collapsed: 'w-14',
  normal: 'w-64',
  wide: 'w-80',
};

interface Props {
  mode: SidebarMode;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onRefreshWorkspaces?: () => void;
}

export default function AppSidebar({ mode, onSelectSession, onCreateSession, onRefreshWorkspaces }: Props) {
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
    if (!trimmed) return sessions;
    return sessions.filter((s) =>
      (s.title ?? s.sessionId).toLowerCase().includes(trimmed),
    );
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

  return (
    <aside className={`${MODE_WIDTH[mode]} flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all`}>
      <div className="p-3 border-b border-zinc-800 space-y-2">
        {!collapsed ? (
          <WorkspaceSwitcher onSwitched={() => void refreshWorkspaces()} />
        ) : (
          <div className="flex justify-center">
            <WorkspaceSwitcher compact onSwitched={() => void refreshWorkspaces()} />
          </div>
        )}
        {!collapsed && (
          <span className={`text-[10px] ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            Gateway {status}
          </span>
        )}
      </div>

      <nav className="p-2 space-y-1 border-b border-zinc-800">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.route}
            to={item.route}
            end={item.route === ROUTES.chat}
            title={item.label}
            className={({ isActive }) =>
              `block ${collapsed ? 'px-2 py-2 text-center' : 'px-3 py-2'} rounded text-sm ${
                isActive ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'
              }`
            }
          >
            {collapsed ? item.label.slice(0, 1) : item.label}
            {!collapsed && <span className="float-right text-[10px] text-zinc-600">Ctrl+{item.shortcut}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="p-3 border-b border-zinc-800 space-y-2">
          <button
            type="button"
            onClick={() => {
              void onCreateSession();
              navigate(ROUTES.chat);
            }}
            className="w-full px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
          >
            New session
          </button>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions"
            className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600"
          />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && !collapsed && <p className="text-xs text-zinc-500 px-2 py-1">Loading sessions...</p>}
        {!loading && filteredSessions.length === 0 && !collapsed && (
          <p className="text-xs text-zinc-500 px-2 py-1">No sessions yet</p>
        )}
        {filteredSessions.map((s) => (
          <button
            key={s.sessionId}
            type="button"
            title={s.title ?? s.sessionId}
            onClick={() => {
              onSelectSession(s.sessionId);
              navigate(ROUTES.chat);
            }}
            className={`w-full text-left ${collapsed ? 'px-1 py-2 text-center' : 'px-3 py-2'} rounded text-sm truncate ${
              s.sessionId === currentId
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            {collapsed ? (s.title ?? s.sessionId).slice(0, 1) : (s.title ?? s.sessionId.slice(0, 12))}
          </button>
        ))}
      </nav>

      <div className="p-2 border-t border-zinc-800 space-y-2">
        <ScoutWidget
          score={trustScore}
          events={securityEvents}
          killSwitchActive={killSwitchActive}
          killSwitchReason={killSwitchReason}
          scoutConnected={scoutConnected}
          scoutUrl={scoutUrl}
          expanded={scoutExpanded || mode === 'wide'}
          compact={collapsed}
          onToggle={() => setScoutExpanded((value) => !value)}
          onOpenReport={() => navigate(ROUTES.scout)}
        />
        <UsagePanel
          planName={plan?.name ?? 'Free'}
          creditsRemaining={usage?.creditsRemaining ?? 0}
          tokensUsed={usage?.tokensUsed ?? 0}
          tokenLimit={usage?.tokenLimit ?? 100_000}
          messagesSent={usage?.messagesSent ?? 0}
          sessions={billingSessions}
          expanded={usageExpanded || mode === 'wide'}
          compact={collapsed}
          onToggle={() => setUsageExpanded((value) => !value)}
          onUpgrade={() => window.open('https://app.carinaai.uk/billing', '_blank')}
        />
      </div>
    </aside>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  BarChart2,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  CreditCard,
  Database,
  FileText,
  FolderOpen,
  Hash,
  Home,
  Key,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Package,
  Plus,
  ScrollText,
  Search,
  Server,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  StickyNote,
  Terminal as TerminalIcon,
  Trash2,
  User,
  UserCircle,
  Waypoints,
  Webhook,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAppearance } from '@/hooks/useAppearance';
import { useTerminalAccess } from '@/hooks/useTerminalAccess';
import { useCloudCapabilities } from '@/hooks/useCloudCapabilities';
import { hasCloudCapability, routeRequiresCoreProxy } from '@/lib/cloud-capabilities';
import {
  NAV_GROUPS,
  NAV_PANELS,
  NAV_ROUTES,
  filterNavForSurface,
  filterNavGroupsForSurface,
  filterNavPanelsForSurface,
  type NavGroup,
  type NavGroupId,
  type NavPanel,
  type NavRoute,
} from '@/lib/workspace-nav';
import { useProductSurface } from '@/hooks/useProductSurface';
import { useTranslation, type TranslationKey } from '@/i18n/translate';
import {
  GROUP_LABEL_KEYS,
  PANEL_LABEL_KEYS,
  ROUTE_LABEL_KEYS,
} from '@/i18n/nav-keys';
import { hrefToWindowId, preferWindowOverlay } from '@/lib/window-manager/definitions';
import { useOptionalWindowManager } from '@/lib/window-manager/WindowManagerContext';
import { BrandMark } from '@/components/shell/BrandMark';
import { authClient } from '@/lib/auth-client';

interface Session {
  id: string;
  title: string;
  lastMessageAt: string | null;
  pinned: boolean;
}

interface AppSidebarProps {
  userEmail: string;
  userName: string;
}

const NAV_ICON_MAP: Record<string, React.ElementType> = {
  Activity,
  BarChart2,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Clock,
  Code2,
  CreditCard,
  Database,
  FileText,
  FolderOpen,
  Hash,
  Home,
  Key,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  LifeBuoy,
  Mail,
  MessageSquare,
  Package,
  Plus,
  ScrollText,
  Search,
  Server,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  StickyNote,
  Terminal: TerminalIcon,
  User,
  UserCircle,
  Waypoints,
  Webhook,
  Wrench,
};

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = NAV_ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className ?? 'h-3.5 w-3.5'} />;
}

function useLocalizedNav() {
  const { t } = useTranslation();

  return {
    routeLabel(route: NavRoute) {
      const key = ROUTE_LABEL_KEYS[route.href];
      return key ? t(key as TranslationKey) : route.label;
    },
    panelLabel(panel: NavPanel) {
      const key = PANEL_LABEL_KEYS[panel.id];
      return key ? t(key as TranslationKey) : panel.label;
    },
    groupLabel(group: NavGroup) {
      const key = GROUP_LABEL_KEYS[group.id];
      return key ? t(key as TranslationKey) : group.label;
    },
  };
}

function isRouteVisible(
  route: NavRoute,
  terminalAccess: { canUseTerminal: boolean; loading: boolean },
  capabilities: ReturnType<typeof useCloudCapabilities>['capabilities'],
): boolean {
  if (route.terminalGated && !terminalAccess.loading && !terminalAccess.canUseTerminal) {
    return false;
  }
  const capabilityKey = routeRequiresCoreProxy(route.href);
  if (capabilityKey && capabilities && !hasCloudCapability(capabilities, capabilityKey)) {
    return false;
  }
  return true;
}

export function AppSidebar({ userEmail, userName }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const userToggled = useRef(false);
  const appearance = useAppearance();
  const pathname = usePathname();
  const router = useRouter();
  const { canUseTerminal, loading: terminalAccessLoading } = useTerminalAccess();
  const { capabilities } = useCloudCapabilities();
  const { routeLabel, panelLabel, groupLabel } = useLocalizedNav();
  const { t } = useTranslation();
  const productSurface = useProductSurface();
  const isAivaProduct = productSurface === 'aiva';
  const navGroups = filterNavGroupsForSurface(productSurface, NAV_GROUPS);
  const navRoutes = filterNavForSurface(productSurface, NAV_ROUTES);
  const navPanels = filterNavPanelsForSurface(productSurface, NAV_PANELS);
  const homeHref = '/launcher';

  const [openGroupId, setOpenGroupId] = useState<NavGroupId | null>('workspace');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('carina.nav-group');
      if (stored) setOpenGroupId((stored as NavGroupId) || null);
    } catch {
      // ignore
    }
  }, []);

  function toggleGroup(groupId: NavGroupId) {
    setOpenGroupId((current) => {
      const next = current === groupId ? null : groupId;
      try {
        localStorage.setItem('carina.nav-group', next ?? '');
      } catch {
        // ignore
      }
      return next;
    });
  }

  useEffect(() => {
    if (!userToggled.current) setCollapsed(appearance.sidebarCollapsed);
  }, [appearance.sidebarCollapsed]);

  useEffect(() => {
    function handleToggleSidebar() {
      userToggled.current = true;
      setCollapsed((current) => !current);
    }

    document.addEventListener('toggle-sidebar', handleToggleSidebar);
    return () => document.removeEventListener('toggle-sidebar', handleToggleSidebar);
  }, []);

  useEffect(() => {
    function fetchSessions() {
      fetch('/api/sessions')
        .then((r) => r.json())
        .then((data) => {
          if (data.data) setSessions(data.data);
        })
        .catch(() => {});
    }
    fetchSessions();
    document.addEventListener('refresh-sessions', fetchSessions);
    return () => document.removeEventListener('refresh-sessions', fetchSessions);
  }, []);

  async function newChat() {
    const res = await fetch('/api/sessions', { method: 'POST' });
    const data = await res.json();
    if (data.data?.id) router.push(`/chat/${data.data.id}`);
  }

  async function signOut() {
    await authClient.signOut();
    window.location.href = '/login';
  }

  const initials = (userName || userEmail).slice(0, 2).toUpperCase();

  if (collapsed) {
    return (
      <aside className="flex w-12 flex-col items-center gap-1.5 border-r border-border bg-surface py-3">
        <Tooltip text={t('sidebar.expand')} side="right">
          <IconButton
            label={t('sidebar.expand')}
            onClick={() => {
              userToggled.current = true;
              setCollapsed(false);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        {!isAivaProduct ? (
          <Tooltip text={t('sidebar.newChat')} side="right">
            <IconButton label={t('sidebar.newChat')} onClick={newChat}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </Tooltip>
        ) : null}
        <Tooltip text={t('sidebar.searchShortcut')} side="right">
          <IconButton
            label={t('sidebar.search')}
            onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}
          >
            <Search className="h-4 w-4" />
          </IconButton>
        </Tooltip>

        <div className="my-1 w-6 border-t border-border" />

        {navGroups.map((group) => {
          const groupRoutes = navRoutes.filter((r) => r.group === group.id);
          const isGroupActive = groupRoutes.some(
            (r) => pathname === r.href || (r.href !== '/' && pathname.startsWith(`${r.href}/`)),
          );
          return (
            <Tooltip key={group.id} text={groupLabel(group)} side="right">
              <IconButton
                label={groupLabel(group)}
                onClick={() => {
                  userToggled.current = true;
                  setCollapsed(false);
                  setOpenGroupId(group.id);
                }}
                className={isGroupActive ? 'text-accent' : ''}
              >
                <NavIcon name={group.iconName} className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          );
        })}

        <div className="flex-1" />

        <Tooltip text={t('nav.settings')} side="right">
          <IconButton label={t('nav.settings')} onClick={() => router.push('/settings')}>
            <Settings className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text={t('sidebar.signOut')} side="right">
          <IconButton label={t('sidebar.signOut')} onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text={userEmail} side="right">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-dim text-accent text-xs font-medium">
            {initials}
          </div>
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between px-3 py-3">
        <Link
          href={homeHref}
          className="transition-colors hover:text-accent"
        >
          <BrandMark />
        </Link>
        <IconButton
          label={t('sidebar.collapse')}
          onClick={() => {
            userToggled.current = true;
            setCollapsed(true);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="flex gap-1 px-2 pb-2">
        {!isAivaProduct ? (
          <button
            type="button"
            onClick={newChat}
            className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('sidebar.newChat')}
          </button>
        ) : null}
        <IconButton
          label={t('sidebar.searchShortcut')}
          onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}
        >
          <Search className="h-4 w-4" />
        </IconButton>
      </div>

      {!isAivaProduct ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          <SessionList sessions={sessions} currentPath={pathname} />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="max-h-[45vh] overflow-y-auto border-t border-border px-2 py-2">
        {navGroups.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            groupLabel={groupLabel(group)}
            routes={navRoutes.filter((r) => r.group === group.id && !r.parent)}
            panels={navPanels.filter((p) => p.group === group.id)}
            isOpen={openGroupId === group.id}
            onToggle={() => toggleGroup(group.id)}
            pathname={pathname}
            terminalAccess={{ canUseTerminal, loading: terminalAccessLoading }}
            capabilities={capabilities}
            routeLabel={routeLabel}
            panelLabel={panelLabel}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border px-3 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-dim text-accent text-xs font-medium">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text-primary">{userName || userEmail}</p>
          <p className="truncate text-[10px] text-text-muted">{userEmail}</p>
        </div>
        <IconButton label={t('nav.settings')} onClick={() => router.push('/settings')}>
          <Settings className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label={t('sidebar.signOut')} onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </aside>
  );
}

function NavGroupSection({
  group,
  groupLabel,
  routes,
  panels,
  isOpen,
  onToggle,
  pathname,
  terminalAccess,
  capabilities,
  routeLabel,
  panelLabel,
}: {
  group: NavGroup;
  groupLabel: string;
  routes: NavRoute[];
  panels: NavPanel[];
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  terminalAccess: { canUseTerminal: boolean; loading: boolean };
  capabilities: ReturnType<typeof useCloudCapabilities>['capabilities'];
  routeLabel: (route: NavRoute) => string;
  panelLabel: (panel: NavPanel) => string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const prevOpen = useRef(isOpen);

  useEffect(() => {
    const justOpened = !prevOpen.current && isOpen;
    prevOpen.current = isOpen;
    if (justOpened && groupRef.current) {
      const node = groupRef.current;
      requestAnimationFrame(() => {
        node.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
      });
    }
  }, [isOpen]);

  const visibleRoutes = routes.filter((r) => isRouteVisible(r, terminalAccess, capabilities));
  if (visibleRoutes.length === 0 && panels.length === 0) return null;

  const groupIsActive = visibleRoutes.some(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );

  return (
    <div ref={groupRef} className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary"
      >
        <span className={groupIsActive ? 'text-accent' : ''}>{groupLabel}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen ? '' : '-rotate-90')} />
      </button>

      {isOpen && (
        <div>
          {visibleRoutes.map((route) => (
            <NavRouteRow
              key={route.href}
              route={route}
              pathname={pathname}
              label={routeLabel(route)}
            />
          ))}
          {panels.map((panel) => (
            <NavPanelRow key={panel.id} panel={panel} label={panelLabel(panel)} />
          ))}
        </div>
      )}
    </div>
  );
}

function navLinkPrefetch(href: string): boolean {
  return !href.startsWith('/aiva')
    && !href.startsWith('/conversations')
    && !href.startsWith('/billing/aiva');
}

function NavRouteRow({
  route,
  pathname,
  label,
}: {
  route: NavRoute;
  pathname: string;
  label: string;
}) {
  const isActive =
    pathname === route.href ||
    (route.href !== '/' && pathname.startsWith(`${route.href}/`));
  const windowManager = useOptionalWindowManager();
  const windowId = hrefToWindowId(route.href);
  const useWindows = preferWindowOverlay(pathname) && windowId && windowManager;
  const isWindowOpen = windowId && windowManager ? windowManager.isOpen(windowId) : false;

  if (useWindows && windowId && windowManager) {
    return (
      <button
        type="button"
        onClick={() => windowManager.toggleWindow(windowId)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left',
          isActive || isWindowOpen
            ? 'bg-elevated font-medium text-text-primary'
            : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
        )}
      >
        <span className={isActive || isWindowOpen ? 'text-accent' : 'text-text-muted'}>
          <NavIcon name={route.iconName} />
        </span>
        <span className="flex-1 truncate">{label}</span>
        {isWindowOpen ? <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> : null}
      </button>
    );
  }

  return (
    <Link
      href={route.href}
      prefetch={navLinkPrefetch(route.href)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
        isActive
          ? 'bg-elevated font-medium text-text-primary'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
      )}
    >
      <span className={isActive ? 'text-accent' : 'text-text-muted'}>
        <NavIcon name={route.iconName} />
      </span>
      {label}
    </Link>
  );
}

function NavPanelRow({ panel, label }: { panel: NavPanel; label: string }) {
  const pathname = usePathname();
  const windowManager = useOptionalWindowManager();
  const windowId = panel.id;
  const useWindows = preferWindowOverlay(pathname) && windowManager;
  const isWindowOpen = windowManager?.isOpen(windowId) ?? false;

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      onClick={() => {
        if (useWindows) {
          windowManager.toggleWindow(windowId);
          return;
        }
        document.dispatchEvent(new CustomEvent('open-panel', { detail: panel.id }));
      }}
    >
      <span className={isWindowOpen ? 'text-accent' : 'text-text-muted'}>
        <NavIcon name={panel.iconName} />
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {isWindowOpen ? <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> : null}
    </button>
  );
}

function SessionList({ sessions, currentPath }: { sessions: Session[]; currentPath: string }) {
  const { t } = useTranslation();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7 = new Date(today.getTime() - 7 * 86400000);

  const pinned = sessions.filter((s) => s.pinned);
  const todaySessions = sessions.filter(
    (s) => !s.pinned && s.lastMessageAt && new Date(s.lastMessageAt) >= today,
  );
  const yesterdaySessions = sessions.filter(
    (s) =>
      !s.pinned &&
      s.lastMessageAt &&
      new Date(s.lastMessageAt) >= yesterday &&
      new Date(s.lastMessageAt) < today,
  );
  const last7Sessions = sessions.filter(
    (s) =>
      !s.pinned &&
      s.lastMessageAt &&
      new Date(s.lastMessageAt) >= last7 &&
      new Date(s.lastMessageAt) < yesterday,
  );
  const older = sessions.filter(
    (s) => !s.pinned && (!s.lastMessageAt || new Date(s.lastMessageAt) < last7),
  );

  return (
    <div className="space-y-1 py-1">
      {pinned.length > 0 && (
        <SessionGroup label={t('sidebar.pinned')} sessions={pinned} currentPath={currentPath} />
      )}
      {todaySessions.length > 0 && (
        <SessionGroup label={t('sidebar.today')} sessions={todaySessions} currentPath={currentPath} />
      )}
      {yesterdaySessions.length > 0 && (
        <SessionGroup
          label={t('sidebar.yesterday')}
          sessions={yesterdaySessions}
          currentPath={currentPath}
        />
      )}
      {last7Sessions.length > 0 && (
        <SessionGroup
          label={t('sidebar.last7Days')}
          sessions={last7Sessions}
          currentPath={currentPath}
        />
      )}
      {older.length > 0 && (
        <SessionGroup label={t('sidebar.older')} sessions={older} currentPath={currentPath} />
      )}
      {sessions.length === 0 && (
        <p className="px-2 py-4 text-center text-xs text-text-muted">{t('sidebar.noChats')}</p>
      )}
    </div>
  );
}

function SessionGroup({
  label,
  sessions,
  currentPath,
}: {
  label: string;
  sessions: Session[];
  currentPath: string;
}) {
  return (
    <div>
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      {sessions.map((s) => (
        <SessionItem key={s.id} session={s} active={currentPath === `/chat/${s.id}`} />
      ))}
    </div>
  );
}

function SessionItem({ session, active }: { session: Session; active: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  async function archive() {
    await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    document.dispatchEvent(new Event('refresh-sessions'));
  }

  async function deleteSession() {
    await fetch(`/api/sessions/${session.id}`, { method: 'DELETE' });
    document.dispatchEvent(new Event('refresh-sessions'));
    if (window.location.pathname === `/chat/${session.id}`) router.push('/launcher');
  }

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors',
        active
          ? 'bg-elevated text-text-primary'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
      )}
      onClick={() => router.push(`/chat/${session.id}`)}
    >
      <MessageSquare className="h-3 w-3 shrink-0 text-text-muted" />
      <span className="flex-1 truncate">{session.title}</span>
      <div className="hidden items-center group-hover:flex" onClick={(e) => e.stopPropagation()}>
        <IconButton label={t('sidebar.sessionOptions')} size="sm" onClick={() => setMenuOpen(!menuOpen)}>
          <MoreHorizontal className="h-3 w-3" />
        </IconButton>
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border border-border bg-overlay shadow-lg">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-elevated hover:text-text-primary"
              onClick={archive}
            >
              <Archive className="h-3 w-3" /> {t('sidebar.archive')}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-elevated"
              onClick={deleteSession}
            >
              <Trash2 className="h-3 w-3" /> {t('sidebar.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { type ReactNode } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { LauncherStatusBar } from './LauncherStatusBar';

type NavPath = '/launcher' | '/workspaces' | '/projects' | '/memory' | '/skills' | '/channels' | '/scout' | '/settings';

interface Props {
  children: ReactNode;
  activePath: NavPath;
  onNavigate: (path: NavPath) => void;
}

const NAV_ITEMS: Array<{ href: NavPath; label: string; icon: () => React.ReactElement }> = [
  { href: '/launcher',   label: 'Home',       icon: HomeIcon       },
  { href: '/workspaces', label: 'Workspaces', icon: GridIcon       },
  { href: '/projects',   label: 'Projects',   icon: FolderIcon     },
  { href: '/memory',     label: 'Memory',     icon: BrainIcon      },
  { href: '/skills',     label: 'Skills',     icon: ZapIcon        },
  { href: '/channels',   label: 'Channels',   icon: ChatIcon       },
  { href: '/scout',      label: 'Scout',      icon: ShieldIcon     },
  { href: '/settings',   label: 'Settings',   icon: GearIcon       },
];

export function LauncherWithSidebar({ children, activePath, onNavigate }: Props) {
  const { user } = useCurrentUser();

  return (
    <div className="launcher-shell">
      <div className="launcher-body-sidebar">
        <aside className="launcher-sidebar">
          <div className="sidebar-brand">
            <img src="/logo/carina_logo_1.png" alt="Carina" className="sidebar-logo" />
            <div>
              <span className="sidebar-brand-name">Carina</span>
              <span className="sidebar-brand-workspace">{user ? `${user.firstName}'s Workspace` : 'Workspace'}</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {NAV_ITEMS.map(item => (
              <button
                key={item.href}
                className={`sidebar-nav-item${activePath === item.href ? ' active' : ''}`}
                onClick={() => onNavigate(item.href)}
                type="button"
              >
                <item.icon />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="" />
                : <span>{user?.firstName?.[0] ?? '?'}</span>
              }
            </div>
            <div>
              <span className="sidebar-user-name">{user?.firstName ?? 'User'}</span>
              <span className="sidebar-user-role">{user?.role ?? 'Member'}</span>
            </div>
          </div>
        </aside>

        <main className="launcher-sidebar-content">
          {children}
        </main>
      </div>

      <LauncherStatusBar />
    </div>
  );
}

/* Inline SVG icons - 18x18 */
function HomeIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function GridIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function FolderIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
}
function BrainIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.08-4.97A3 3 0 0 1 6 9a2.99 2.99 0 0 1 1.5-2.6A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.08-4.97A3 3 0 0 0 18 9a2.99 2.99 0 0 0-1.5-2.6A2.5 2.5 0 0 0 14.5 2z"/></svg>;
}
function ZapIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}
function ChatIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function ShieldIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function GearIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}

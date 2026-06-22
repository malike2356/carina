'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { LauncherStatusBar } from './LauncherStatusBar';

export type LauncherNavPath =
  | '/launcher'
  | '/workspaces'
  | '/projects'
  | '/memory'
  | '/skills'
  | '/channels'
  | '/scout'
  | '/settings';

interface NavItem {
  path: LauncherNavPath;
  label: string;
  href?: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/launcher',
    label: 'Home',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    path: '/workspaces',
    label: 'Workspaces',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    path: '/projects',
    label: 'Projects',
    href: '/dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    path: '/memory',
    label: 'Memory',
    href: '/library',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.08-4.97A3 3 0 0 1 6 9a2.99 2.99 0 0 1 1.5-2.6A2.5 2.5 0 0 1 9.5 2z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.08-4.97A3 3 0 0 0 18 9a2.99 2.99 0 0 0-1.5-2.6A2.5 2.5 0 0 0 14.5 2z" />
      </svg>
    ),
  },
  {
    path: '/skills',
    label: 'Skills',
    href: '/settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    path: '/channels',
    label: 'Channels',
    href: '/settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    path: '/scout',
    label: 'Scout',
    href: '/security',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

interface Props {
  children: ReactNode;
  activePath: LauncherNavPath;
  userName: string;
  scoutPaired: boolean;
  onNavigate: (path: LauncherNavPath) => void;
}

export function LauncherWithSidebar({ children, activePath, userName, scoutPaired, onNavigate }: Props) {
  const router = useRouter();
  const firstName = userName.split(' ')[0] || 'User';

  const handleNav = (item: NavItem) => {
    if (item.path === '/workspaces' || item.path === '/launcher') {
      onNavigate(item.path);
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden" style={{ background: '#060c18', color: '#e8f0f8' }}>
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex flex-col shrink-0 w-[200px] border-r" style={{ background: '#080f1e', borderColor: '#1a2b45' }}>
          <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: '#1a2b45' }}>
            <Image src="/carina_logo_1.png" alt="Carina" width={32} height={32} className="object-contain" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#e8f0f8' }}>Carina</p>
              <p className="text-[11px] truncate" style={{ color: '#6b8aaa' }}>{firstName}&apos;s Workspace</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1 p-3 flex-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm border-none cursor-pointer transition-colors"
                style={{
                  background: activePath === item.path ? '#121f35' : 'transparent',
                  color: activePath === item.path ? '#00d4ff' : '#6b8aaa',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 px-4 py-4 border-t" style={{ borderColor: '#1a2b45' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: '#1a2b45', color: '#e8f0f8' }}>
              {firstName[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#e8f0f8' }}>{firstName}</p>
              <p className="text-[11px]" style={{ color: '#4a6a8a' }}>Owner</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex items-center justify-center p-12 overflow-y-auto">
          {children}
        </main>
      </div>
      <LauncherStatusBar scoutPaired={scoutPaired} />
    </div>
  );
}

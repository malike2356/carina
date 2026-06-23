'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { authClient } from '@/lib/auth-client';
import { LauncherOrbitalTimeline } from '@/components/launcher/LauncherOrbitalTimeline';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTerminalAccess } from '@/hooks/useTerminalAccess';
import { WorkspaceOnboardingCard } from '@/components/settings/WorkspaceOnboardingCard';
import { useClockTime, useGreeting, useRelativeTimeLabel } from '@/hooks/useRelativeTimeLabel';

interface Session {
  id: string;
  title: string;
  lastMessageAt: Date | string | null;
}

interface Props {
  userName: string;
  userEmail: string;
  sessions: Session[];
  totalSessions: number;
  latestSessionId: string | null;
  memoryCount: number;
  skillCount: number;
  keyCount: number;
  taskCount: number;
  activeSkillPacks?: string;
}

function useTimeAgo(date: Date | string | null): string {
  return useRelativeTimeLabel(date);
}

function LiveClock() {
  const time = useClockTime();
  return <>{time}</>;
}

function LastActivityLabel({ date }: { date: Date | string | null }) {
  const ago = useRelativeTimeLabel(date);
  return <span style={{ color: '#16c97e' }}>{ago}</span>;
}

type NavItem =
  | { type: 'section'; label: string }
  | { type?: 'link'; label: string; href: string; active?: boolean; icon: React.ReactNode };

const NAV_ITEMS: NavItem[] = [
  { type: 'section', label: 'MAIN' },
  { label: 'Home',     href: '/launcher',                  active: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
  { label: 'New Chat', href: '/api/sessions/new-redirect',               icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="12" y1="8" x2="12" y2="14" /><line x1="9" y1="11" x2="15" y2="11" /></svg> },
  { label: 'Memory',   href: '/library',                                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg> },
  { label: 'Research', href: '/research',                                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
  { label: 'Tasks',    href: '/tasks',                                     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> },
  { label: 'Analytics',href: '/analytics',                                 icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> },

  { type: 'section', label: 'CONTENT' },
  { label: 'Documents', href: '/documents', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
  { label: 'Files',     href: '/files',     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg> },
  { label: 'Notes',     href: '/library',   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> },
  { label: 'Email',     href: '/email',     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
  { label: 'Calendar',  href: '/calendar',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },

  { type: 'section', label: 'TOOLS' },
  { label: 'Terminal',  href: '/terminal',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg> },
  { label: 'Cron',      href: '/cron',      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
  { label: 'Webhooks',  href: '/webhooks',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 0 0 0-6 3 3 0 0 0-3 3c0 .24.04.47.09.7L8.04 9.81A2.99 2.99 0 0 0 6 9a3 3 0 0 0 0 6c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a3 3 0 0 0 6 0 3 3 0 0 0-3-3z" /></svg> },
  { label: 'MCP',       href: '/mcp',       icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg> },
  { label: 'Profiles',  href: '/profiles',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  { label: 'Logs',      href: '/logs',      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /><polyline points="10 9 9 9 8 9" /></svg> },
  { label: 'Env',       href: '/env',       icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg> },

  { type: 'section', label: 'SYSTEM' },
  { label: 'Scout',    href: '/security', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg> },
  { label: 'Billing',  href: '/billing',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
  { label: 'Settings', href: '/settings', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14M12 2v2M12 20v2M2 12h2M20 12h2" /></svg> },
];

const QUICK_ACTIONS = [
  { label: 'New Chat', href: '/api/sessions/new-redirect', color: '#00d4ff', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="12" y1="8" x2="12" y2="14" /><line x1="9" y1="11" x2="15" y2="11" /></svg> },
  { label: 'Add Memory', href: '/library', color: '#f59e0b', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg> },
  { label: 'API Keys', href: '/settings/keys', color: '#7c3aed', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg> },
  { label: 'Load Skills', href: '/settings', color: '#ec4899', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
  { label: 'Schedule', href: '/tasks', color: '#0ea5e9', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
  { label: 'Terminal', href: '/terminal', color: '#16c97e', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg> },
];

// Geometry: CX=240, CY=190, R=130. D=92 = R/sqrt(2) for true 45-degree diagonals.
// Models sits due North (pure -Y), Scout due South (+Y).
// Memory due West (-X), Channels due East (+X) -- both share y=CY (horizontal axis).
// Skills SW (-D, +D), Tools SE (+D, +D) -- 45-degree diagonals, equal dx and dy.
const _CX = 240, _CY = 190, _R = 130, _D = 92;

const ORBITAL_NODES = [
  { label: 'Models',   sub: (k: number) => k > 0 ? `${k} Ready` : 'No keys', x: _CX,      y: _CY - _R, color: '#7c3aed', lx: _CX,       ly: _CY - _R - 34, anchor: 'middle' as const },
  { label: 'Memory',   sub: (m: number) => `${m} Stored`,                     x: _CX - _R, y: _CY,      color: '#f59e0b', lx: _CX-_R-30, ly: _CY - 14,      anchor: 'end'    as const },
  { label: 'Channels', sub: (_: number) => 'Connected',                        x: _CX + _R, y: _CY,      color: '#00d4ff', lx: _CX+_R+30, ly: _CY - 14,      anchor: 'start'  as const },
  { label: 'Skills',   sub: (s: number) => `${s} Loaded`,                     x: _CX - _D, y: _CY + _D, color: '#ec4899', lx: _CX-_D-16, ly: _CY+_D+34,     anchor: 'end'    as const },
  { label: 'Tools',    sub: (_: number) => 'Built-in',                        x: _CX + _D, y: _CY + _D, color: '#0ea5e9', lx: _CX+_D+16, ly: _CY+_D+34,     anchor: 'start'  as const },
  { label: 'Scout',    sub: (_: number) => 'Monitoring',                       x: _CX,      y: _CY + _R, color: '#16c97e', lx: _CX,       ly: _CY+_R+34,     anchor: 'middle' as const },
];

function OrbitalDiagram({ keyCount, memoryCount, skillCount }: { keyCount: number; memoryCount: number; skillCount: number }) {
  const CX = _CX, CY = _CY;
  const vals = [keyCount, memoryCount, 0, skillCount, 0, 0];

  return (
    <svg viewBox="0 0 480 390" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="og-center" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="1" />
          <stop offset="45%" stopColor="#7c3aed" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#060c18" stopOpacity="0" />
        </radialGradient>
        <filter id="og-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="og-bloom">
          <feGaussianBlur stdDeviation="11" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {ORBITAL_NODES.map((n) => (
          <linearGradient key={n.label} id={`og-b-${n.label}`}
            x1={n.x} y1={n.y} x2={CX} y2={CY} gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor={n.color}   stopOpacity="0.9" />
            <stop offset="65%"  stopColor={n.color}   stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff"   stopOpacity="0.8" />
          </linearGradient>
        ))}
      </defs>

      {/* Orbit rings */}
      <circle cx={CX} cy={CY} r={_R}        fill="none" stroke="#1a2b45" strokeWidth="1" strokeDasharray="5 7"  opacity="0.4" />
      <circle cx={CX} cy={CY} r={_R * 0.58} fill="none" stroke="#1a2b45" strokeWidth="1" strokeDasharray="2 9"  opacity="0.22" />

      {/* Beams */}
      {ORBITAL_NODES.map((n) => (
        <g key={`beam-${n.label}`}>
          <line x1={n.x} y1={n.y} x2={CX} y2={CY}
            stroke={`url(#og-b-${n.label})`} strokeWidth="2.5"
            strokeLinecap="round" opacity="0.8" filter="url(#og-glow)" />
          <line x1={n.x} y1={n.y} x2={CX} y2={CY}
            stroke={n.color} strokeWidth="0.8" strokeLinecap="round" opacity="0.25" />
        </g>
      ))}

      {/* Core */}
      <circle cx={CX} cy={CY} r="38" fill="url(#og-center)" opacity="0.2"  filter="url(#og-bloom)" />
      <circle cx={CX} cy={CY} r="20" fill="#060c18" stroke="#00d4ff" strokeWidth="1.5" opacity="0.95" />
      <circle cx={CX} cy={CY} r="13" fill="#0d1829" />
      <circle cx={CX} cy={CY} r="7"  fill="#00d4ff" filter="url(#og-glow)" opacity="0.95" />
      <circle cx={CX} cy={CY} r="3.5" fill="#ffffff" />
      <text x={CX} y={CY - 26} textAnchor="middle" fill="#8aa4be" fontSize="10" fontWeight="500" letterSpacing="0.06em">Carina Core</text>

      {/* Satellite nodes */}
      {ORBITAL_NODES.map((n, i) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r="22" fill="#0d1829" stroke={n.color} strokeWidth="1.5" opacity="0.95" />
          <circle cx={n.x} cy={n.y} r="14" fill="#060c18" opacity="0.75" />
          <circle cx={n.x} cy={n.y} r="6"  fill={n.color}  filter="url(#og-glow)" opacity="0.9" />
          <circle cx={n.x} cy={n.y} r="3"  fill="#ffffff"  opacity="0.9" />
          <text x={n.lx} y={n.ly}      textAnchor={n.anchor} fill="#ccdce8" fontSize="11"   fontWeight="600" letterSpacing="0.02em">{n.label}</text>
          <text x={n.lx} y={n.ly + 14} textAnchor={n.anchor} fill={n.color}  fontSize="9.5" opacity="0.9">{n.sub(vals[i])}</text>
        </g>
      ))}
    </svg>
  );
}

function SessionCard({ session, index }: { session: Session; index: number }) {
  const colors = ['#7c3aed', '#00d4ff', '#16c97e', '#f59e0b', '#ec4899', '#0ea5e9'];
  const color = colors[index % colors.length];
  const ago = useTimeAgo(session.lastMessageAt);

  return (
    <Link
      href={`/chat/${session.id}`}
      className="flex flex-col gap-2 px-3 py-3 rounded-lg border transition-all group h-full"
      style={{ background: '#060c18', borderColor: '#1a2b45' }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = color + '55'; el.style.background = color + '08'; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = '#1a2b45'; el.style.background = '#060c18'; }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: color + '20', color }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold truncate" style={{ color: '#d8e8f4' }}>{session.title || 'New chat'}</div>
          <div className="text-[10.5px]" style={{ color: '#4a6a8a' }}>Chat session</div>
        </div>
        <svg className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
      <div className="text-[10.5px] mt-auto" style={{ color: '#4a6a8a' }}>Updated {ago}</div>
    </Link>
  );
}

function StatusRow({ icon, color, label, value, ok }: { icon: React.ReactNode; color: string; label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: color + '18', color }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-semibold" style={{ color: '#ccdce8' }}>{label}</div>
        <div className="text-[10px] truncate" style={{ color: '#6b8aaa' }}>{value}</div>
      </div>
      {ok
        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16c97e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" /></svg>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      }
    </div>
  );
}

export function LauncherExpanded({
  userName,
  userEmail: _userEmail,
  sessions,
  totalSessions,
  latestSessionId,
  memoryCount,
  skillCount,
  keyCount,
  taskCount,
  activeSkillPacks = '',
}: Props) {
  const router = useRouter();
  const greeting = useGreeting();
  const { canUseTerminal } = useTerminalAccess();
  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.type === 'section' || item.href !== '/terminal' || canUseTerminal),
    [canUseTerminal],
  );
  const quickActions = useMemo(
    () => QUICK_ACTIONS.filter((item) => item.href !== '/terminal' || canUseTerminal),
    [canUseTerminal],
  );
  const firstName = userName.split(' ')[0] || 'there';
  const initials = userName.split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '??';
  const lastActivity = sessions[0]?.lastMessageAt ?? null;

  const statusItems = [
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>, color: '#f59e0b', label: 'Memory',           value: memoryCount > 0 ? `${memoryCount} memories stored` : 'No memories yet',                               ok: memoryCount > 0 },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,          color: '#00d4ff', label: 'Channels',          value: `${totalSessions} active session${totalSessions !== 1 ? 's' : ''}`,                                    ok: totalSessions > 0 },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>, color: '#7c3aed', label: 'Models', value: keyCount > 0 ? `${keyCount} API key${keyCount !== 1 ? 's' : ''} configured` : 'No API keys - add in Settings', ok: keyCount > 0 },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>, color: '#ec4899', label: 'Skills',    value: skillCount > 0 ? `${skillCount} skill${skillCount !== 1 ? 's' : ''} enabled` : 'No skills loaded',     ok: skillCount > 0 },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,  color: '#0ea5e9', label: 'Tasks',             value: taskCount > 0 ? `${taskCount} scheduled task${taskCount !== 1 ? 's' : ''}` : 'No scheduled tasks',     ok: taskCount > 0 },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,             color: '#16c97e', label: 'Scout Protection', value: 'Active - monitoring workspace',                                                                         ok: true },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,                    color: '#6366f1', label: 'Workspace',         value: 'Environment ready',                                                                                    ok: true },
  ];

  const okCount = statusItems.filter((s) => s.ok).length;
  const healthPct = Math.round((okCount / statusItems.length) * 100);
  const allOk = okCount === statusItems.length;

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden" style={{ background: '#060c18', color: '#e8f0f8', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Title bar */}
      <div className="flex items-center px-5 h-9 shrink-0 border-b" style={{ background: '#07101f', borderColor: '#1a2b45' }}>
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#ffbd2e' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#28ca41' }} />
        </div>
        <span className="ml-4 text-[10.5px] font-bold tracking-[0.15em] uppercase" style={{ color: '#3a5a7a' }}>CARINA LAUNCHER</span>
        <span className="ml-2 text-[10px]" style={{ color: '#1e3a52' }}>v1.0.0</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#16c97e', boxShadow: '0 0 5px #16c97e' }} />
          <span className="text-[10.5px] font-bold tracking-[0.1em]" style={{ color: '#16c97e' }}>ONLINE</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar (icon rail) */}
        <div className="flex flex-col w-[56px] shrink-0 border-r overflow-y-auto overflow-x-hidden" style={{ background: '#07101f', borderColor: '#1a2b45' }}>
          <div className="flex justify-center pt-4 pb-3 border-b" style={{ borderColor: '#1a2b45' }}>
            <Tooltip text="Carina" side="right">
              <Image src="/carina_logo_1.png" alt="Carina" width={32} height={32} className="object-contain" priority />
            </Tooltip>
          </div>
          <nav className="flex flex-col gap-0.5 p-1.5 flex-1">
            {navItems.map((item, i) => {
              if (item.type === 'section') {
                if (i === 0) return null;
                return (
                  <div
                    key={`sec-${i}`}
                    className="mx-auto my-1.5 w-5 border-t"
                    style={{ borderColor: '#1a2b45' }}
                    aria-hidden="true"
                  />
                );
              }
              const navItem = item as Extract<NavItem, { href: string }>;
              return (
                <Tooltip key={navItem.label} text={navItem.label} side="right">
                  <Link
                    href={navItem.href}
                    aria-label={navItem.label}
                    className="flex items-center justify-center w-10 h-9 mx-auto rounded-md transition-colors"
                    style={navItem.active
                      ? { color: '#00d4ff', background: 'rgba(0,212,255,0.08)', boxShadow: 'inset 2px 0 0 #00d4ff' }
                      : { color: '#6b8aaa' }
                    }
                  >
                    <span style={{ color: navItem.active ? '#00d4ff' : '#3a5a7a' }}>{navItem.icon}</span>
                  </Link>
                </Tooltip>
              );
            })}
          </nav>
          <div className="p-2 border-t flex justify-center" style={{ borderColor: '#1a2b45' }}>
            <Tooltip text={`${firstName} - Pro Operator`} side="right">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold cursor-default"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #00d4ff)', color: '#fff' }}
              >
                {initials}
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Center */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">

          {/* Top: orbital diagram (left) + orbital timeline (right) */}
          <div className="flex min-h-0" style={{ flex: '3 1 0' }}>

            {/* Left half: orbital + wordmark */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0 border-r" style={{ borderColor: '#1a2b45' }}>
              <div className="flex-1 min-h-0 flex items-center justify-center" style={{ padding: '8px 8px 0' }}>
                <OrbitalDiagram keyCount={keyCount} memoryCount={memoryCount} skillCount={skillCount} />
              </div>
              <div className="shrink-0 flex flex-col items-center py-2">
                <span className="font-black tracking-[0.12em] leading-none" style={{ fontSize: 'clamp(26px, 3vw, 44px)', color: '#e8f0f8' }}>CARINA</span>
                <span className="font-bold tracking-[0.22em] uppercase mt-1" style={{ fontSize: 'clamp(7px, 0.6vw, 9px)', color: '#00d4ff' }}>ONE MEMORY. ONE AGENT. EVERYWHERE.</span>
              </div>
            </div>

            <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
              <div className="shrink-0 px-3 h-9 flex items-center border-b" style={{ borderColor: '#1a2b45' }}>
                <span className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: '#8aa4be' }}>WORKSPACE ORBIT</span>
                <span className="ml-2 text-[11px]" style={{ color: '#6b8aaa' }}>Click nodes to explore</span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <LauncherOrbitalTimeline
                  memoryCount={memoryCount}
                  skillCount={skillCount}
                  keyCount={keyCount}
                  totalSessions={totalSessions}
                  taskCount={taskCount}
                />
              </div>
            </div>

          </div>

          {/* Bottom panel - grows to fill remaining */}
          <div className="min-h-0 p-3 pt-1 flex flex-col gap-2" style={{ flex: '2 1 0' }}>

            {/* Welcome row */}
            <div className="flex items-center justify-between shrink-0">
              <div>
                <span className="font-semibold" style={{ fontSize: 'clamp(12px, 1.1vw, 14px)', color: '#e8f0f8' }}>{greeting}, {firstName}</span>
                <span className="ml-2" style={{ fontSize: 'clamp(10px, 0.85vw, 12px)', color: '#4a6a8a' }}>{totalSessions} conversation{totalSessions !== 1 ? 's' : ''}</span>
              </div>
              {lastActivity && (
                <div className="text-right">
                  <span className="text-[9.5px] uppercase tracking-[0.08em]" style={{ color: '#3a5a7a' }}>Last active </span>
                  <LastActivityLabel date={lastActivity} />
                </div>
              )}
            </div>

            <WorkspaceOnboardingCard
              keyCount={keyCount}
              activeSkillPacks={activeSkillPacks}
            />

            {/* Session grid - flex-1 so it takes remaining space */}
            <div className="flex-1 min-h-0 grid gap-2" style={{ gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr' }}>
              {sessions.length > 0
                ? sessions.slice(0, 6).map((s, i) => <SessionCard key={s.id} session={s} index={i} />)
                : (
                  <div className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-lg border" style={{ borderColor: '#1a2b45', color: '#3a5a7a' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    <span className="text-[12px]">No conversations yet</span>
                    <Link href="/api/sessions/new-redirect" className="text-[11px] px-3 py-1.5 rounded-md border" style={{ color: '#00d4ff', borderColor: '#00d4ff33' }}>Start one</Link>
                  </div>
                )
              }
            </div>

            {totalSessions > 6 && (
              <div className="shrink-0">
                <Link href="/api/sessions/new-redirect" className="text-[10.5px]" style={{ color: '#00d4ff' }}>
                  +{totalSessions - 6} more sessions &#8594;
                </Link>
              </div>
            )}

            {/* Quick actions */}
            <div className="shrink-0">
              <div className="text-[9px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#2a4a6a' }}>QUICK ACTIONS</div>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {quickActions.map((a) => (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-md border transition-all font-medium"
                    style={{ borderColor: '#1a2b45', background: '#07101f', color: '#8aaabe', fontSize: 'clamp(10px, 0.85vw, 12px)' }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = a.color + '44'; el.style.color = a.color; el.style.background = a.color + '0c'; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = '#1a2b45'; el.style.color = '#8aaabe'; el.style.background = '#07101f'; }}
                  >
                    <span style={{ color: a.color }}>{a.icon}</span>
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Workspace stats strip */}
            <div className="shrink-0 grid gap-2 rounded-lg border p-3" style={{ borderColor: '#1a2b45', background: '#07101f', gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {[
                { label: 'Sessions', value: totalSessions, color: '#00d4ff', href: '/api/sessions/new-redirect' },
                { label: 'Memories', value: memoryCount,   color: '#f59e0b', href: '/library' },
                { label: 'Tasks',    value: taskCount,     color: '#0ea5e9', href: '/tasks' },
                { label: 'API Keys', value: keyCount,      color: '#7c3aed', href: '/settings/keys' },
              ].map((stat) => (
                <Link key={stat.label} href={stat.href} className="flex flex-col items-center gap-1 py-1 rounded-md transition-colors" style={{ color: 'inherit' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = stat.color + '0c'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
                >
                  <span className="font-black leading-none" style={{ fontSize: 'clamp(18px, 1.8vw, 26px)', color: stat.value > 0 ? stat.color : '#2a4a6a' }}>{stat.value}</span>
                  <span className="tracking-[0.06em]" style={{ fontSize: 'clamp(9px, 0.75vw, 11px)', color: '#4a6a8a' }}>{stat.label}</span>
                </Link>
              ))}
            </div>

          </div>
        </div>

        {/* Right panel */}
        <div className="w-[300px] shrink-0 flex flex-col border-l overflow-y-auto" style={{ borderColor: '#1a2b45', background: '#07101f' }}>

          {/* System Status - flex-1 to push everything else down */}
          <div className="p-4 border-b flex-1 min-h-0 overflow-y-auto" style={{ borderColor: '#1a2b45' }}>
            <div className="text-[9px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: '#2a4a6a' }}>SYSTEM STATUS</div>
            <div className="flex flex-col">
              {statusItems.map((item) => (
                <StatusRow key={item.label} icon={item.icon} color={item.color} label={item.label} value={item.value} ok={item.ok} />
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="px-4 py-3 border-b" style={{ borderColor: '#1a2b45' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#16c97e18', color: '#16c97e' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <div>
                  <div className="text-[9px] font-bold tracking-[0.1em] uppercase" style={{ color: '#2a4a6a' }}>SYSTEM HEALTH</div>
                  <div className="text-[10px]" style={{ color: allOk ? '#16c97e' : '#f59e0b' }}>
                    {allOk ? 'All services operational' : `${okCount}/${statusItems.length} services ready`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[18px] font-black" style={{ color: allOk ? '#16c97e' : '#f59e0b' }}>{healthPct}%</span>
                <svg width="28" height="28" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#1a2b45" strokeWidth="3" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke={allOk ? '#16c97e' : '#f59e0b'} strokeWidth="3"
                    strokeDasharray={`${(healthPct / 100) * 87.96} 87.96`} strokeLinecap="round" transform="rotate(-90 18 18)" />
                </svg>
              </div>
            </div>
          </div>

          {/* Quick links in right panel */}
          <div className="px-4 py-3 border-b" style={{ borderColor: '#1a2b45' }}>
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: '#2a4a6a' }}>TOOLS</div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {[
                { label: 'Terminal',  href: '/terminal',  color: '#16c97e' },
                { label: 'Calendar',  href: '/calendar',  color: '#00d4ff' },
                { label: 'Research',  href: '/research',  color: '#7c3aed' },
                { label: 'Analytics', href: '/analytics', color: '#f59e0b' },
                { label: 'Files',     href: '/files',     color: '#0ea5e9' },
                { label: 'Email',     href: '/email',     color: '#ec4899' },
              ].map((t) => (
                <Link key={t.label} href={t.href}
                  className="px-2.5 py-2 rounded-md border transition-all font-medium"
                  style={{ borderColor: '#1a2b45', color: '#6b8aaa', background: 'transparent', fontSize: 'clamp(10px, 0.85vw, 12px)' }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = t.color + '44'; el.style.color = t.color; el.style.background = t.color + '0c'; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = '#1a2b45'; el.style.color = '#6b8aaa'; el.style.background = 'transparent'; }}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Continue Work */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => { if (latestSessionId) router.push(`/chat/${latestSessionId}`); else router.push('/api/sessions/new-redirect'); }}
              className="w-full rounded-xl cursor-pointer flex items-center justify-between px-4 py-4 transition-all"
              style={{ background: 'linear-gradient(135deg, #1a0f5e 0%, #0d1e6e 50%, #0a2860 100%)', border: '1px solid #2a3a8a' }}
              onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.border = '1px solid #4a5aaa'; b.style.boxShadow = '0 0 18px rgba(100,120,255,0.2)'; }}
              onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.border = '1px solid #2a3a8a'; b.style.boxShadow = 'none'; }}
            >
              <div>
                <div className="text-[13px] font-bold tracking-[0.06em] uppercase" style={{ color: '#e8f0f8' }}>{latestSessionId ? 'CONTINUE WORK' : 'START NEW CHAT'}</div>
                <div className="text-[10px] mt-0.5" style={{ color: '#6b8aaa' }}>{latestSessionId ? 'Pick up where you left off' : 'Start your first conversation'}</div>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e8f0f8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center h-8 shrink-0 border-t" style={{ background: '#07101f', borderColor: '#1a2b45' }}>
        {[
          { icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16c97e" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, label: 'SCOUT PROTECTED', sub: 'Governance Active', color: '#16c97e' },
          { icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b8aaa" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>, label: 'ENCRYPTED', sub: 'End-to-end', color: '#6b8aaa' },
          { icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b8aaa" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>, label: 'MEMORY', sub: `${memoryCount} stored`, color: '#6b8aaa' },
          { icon: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b8aaa" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, label: 'VERSION', sub: 'v1.0.0', color: '#6b8aaa' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 border-r h-full" style={{ borderColor: '#1a2b45' }}>
            {item.icon}
            <div>
              <div className="text-[8px] font-bold tracking-[0.1em]" style={{ color: item.color }}>{item.label}</div>
              <div className="text-[8px]" style={{ color: '#2a4a6a' }}>{item.sub}</div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-3 border-r h-full" style={{ borderColor: '#1a2b45' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b8aaa" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          <div>
            <div className="text-[8px] font-bold tracking-[0.1em]" style={{ color: '#6b8aaa' }}>TIME</div>
            <div className="text-[8px]" style={{ color: '#2a4a6a' }}><LiveClock /></div>
          </div>
        </div>
        <div className="ml-auto px-4">
          <button type="button" className="text-[9.5px] hover:underline bg-transparent border-none cursor-pointer p-0" style={{ color: '#2a4a6a' }}
            onClick={() => authClient.signOut().then(() => { window.location.href = '/login'; })}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

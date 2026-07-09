'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import { authClient } from '@/lib/auth-client';
import { useGreeting, useRelativeTimeLabel } from '@/hooks/useRelativeTimeLabel';
import { useTerminalAccess } from '@/hooks/useTerminalAccess';

const C = {
  bg:         '#0c0c0f',
  nav:        '#0e0e12',
  surface:    '#131317',
  card:       '#111115',
  border:     '#1e1e24',
  borderStr:  '#262630',
  accent:     '#00d4ff',
  accentSoft: 'rgba(0,212,255,0.07)',
  text:       '#eaeaf0',
  text2:      '#72728a',
  text3:      '#313138',
  green:      '#34d399',
  amber:      '#f59e0b',
  purple:     '#a78bfa',
} as const;

const TOOLTIP_STYLE: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: '8px',
  color: C.text,
  fontSize: '12px',
  padding: '6px 10px',
};

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
  sessionDates?: string[];
}

function buildActivityData(sessionDates: string[]): { day: string; count: number }[] {
  const result: { day: string; count: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const prefix = `${yyyy}-${mm}-${dd}`;
    const count = sessionDates.filter((s) => s.startsWith(prefix)).length;
    result.push({ day: label, count });
  }
  return result;
}

function TimeAgo({ date }: { date: Date | string | null }) {
  return <>{useRelativeTimeLabel(date)}</>;
}

function SessionCard({ session, index }: { session: Session; index: number }) {
  const dots = [C.accent, C.amber, C.purple, C.green, '#f87171', '#38bdf8'];
  const dot = dots[index % dots.length];
  return (
    <Link
      href={`/chat/${session.id}`}
      className="flex flex-col gap-2 p-4 rounded-xl border transition-all"
      style={{ background: C.card, borderColor: C.border }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = C.borderStr;
        el.style.background = C.surface;
        el.style.boxShadow = `inset 2px 0 0 ${dot}`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = C.border;
        el.style.background = C.card;
        el.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
        <span className="text-[10px] font-medium tracking-wide uppercase" style={{ color: C.text2 }}>Chat</span>
        <span className="ml-auto text-[11px]" style={{ color: C.text3 }}>
          <TimeAgo date={session.lastMessageAt} />
        </span>
      </div>
      <span className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: C.text }}>
        {session.title || 'New chat'}
      </span>
    </Link>
  );
}

const METRIC_ICONS = {
  memory: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  tasks: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  skills: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  keys: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
};

export function LauncherExpanded({
  userName,
  sessions,
  totalSessions,
  latestSessionId,
  memoryCount,
  skillCount,
  keyCount,
  taskCount,
  sessionDates = [],
}: Props) {
  const router = useRouter();
  const greeting = useGreeting();
  const { canUseTerminal } = useTerminalAccess();
  const firstName = userName.split(' ')[0] || 'there';
  const initials = userName
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

  const navLinks = useMemo(() => [
    { label: 'Home',     href: '/launcher',                  active: true },
    { label: 'New chat', href: '/api/sessions/new-redirect'               },
    { label: 'Memory',   href: '/library'                                  },
    { label: 'Tasks',    href: '/tasks'                                    },
    ...(canUseTerminal ? [{ label: 'Terminal', href: '/terminal' }] : []),
    { label: 'Settings', href: '/settings'                                 },
  ], [canUseTerminal]);

  const metrics = [
    { label: 'Memories', value: memoryCount, href: '/library',      color: C.amber,  icon: METRIC_ICONS.memory },
    { label: 'Tasks',    value: taskCount,   href: '/tasks',         color: C.accent, icon: METRIC_ICONS.tasks  },
    { label: 'Skills',   value: skillCount,  href: '/settings',      color: C.purple, icon: METRIC_ICONS.skills },
    { label: 'API keys', value: keyCount,    href: '/settings/keys', color: C.green,  icon: METRIC_ICONS.keys   },
  ];

  const activityData = useMemo(() => buildActivityData(sessionDates), [sessionDates]);

  const configured = [memoryCount, taskCount, skillCount, keyCount].filter((v) => v > 0).length;
  const totalWorkspace = memoryCount + taskCount + skillCount + keyCount;

  const donutData = useMemo(() => {
    if (totalWorkspace === 0) {
      return [{ name: 'Nothing configured', value: 1, color: C.border }];
    }
    return [
      memoryCount > 0 && { name: 'Memory',   value: memoryCount, color: C.amber  },
      taskCount   > 0 && { name: 'Tasks',    value: taskCount,   color: C.accent },
      skillCount  > 0 && { name: 'Skills',   value: skillCount,  color: C.purple },
      keyCount    > 0 && { name: 'API keys', value: keyCount,    color: C.green  },
    ].filter(Boolean) as { name: string; value: number; color: string }[];
  }, [memoryCount, taskCount, skillCount, keyCount, totalWorkspace]);

  const donutLegend = [
    { label: 'Memory',   value: memoryCount, color: C.amber  },
    { label: 'Tasks',    value: taskCount,   color: C.accent },
    { label: 'Skills',   value: skillCount,  color: C.purple },
    { label: 'API keys', value: keyCount,    color: C.green  },
  ];

  return (
    <div
      className="flex flex-col w-full h-screen overflow-hidden"
      style={{ background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Nav bar */}
      <header
        className="flex items-center shrink-0 border-b px-4 sm:px-6"
        style={{ height: '48px', background: C.nav, borderColor: C.border }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: C.accent }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#0c0c0f">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          <span className="text-[14px] font-semibold" style={{ color: C.text }}>Carina</span>
        </div>

        {/* Desktop: divider + nav links + right side */}
        <div className="hidden sm:flex items-center gap-0 flex-1 min-w-0">
          <div className="w-px h-5 mx-4 shrink-0" style={{ background: C.border }} />
          <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-md text-[13px] whitespace-nowrap transition-all shrink-0"
                style={{
                  color:      item.active ? C.accent : C.text2,
                  background: item.active ? C.accentSoft : 'transparent',
                  fontWeight: item.active ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!item.active) {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.color = C.text;
                    el.style.background = C.surface;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!item.active) {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.color = C.text2;
                    el.style.background = 'transparent';
                  }
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-4 flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
              <span className="text-[11px]" style={{ color: C.text2 }}>Online</span>
            </div>
            <div className="w-px h-4" style={{ background: C.border }} />
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
              style={{ background: 'linear-gradient(135deg,#1a3e5c,#162d44)', color: C.accent, border: `1px solid ${C.borderStr}` }}
            >
              {initials}
            </div>
            <span className="text-[12px]" style={{ color: C.text2 }}>{firstName}</span>
            <button
              type="button"
              className="text-[12px] bg-transparent border-none cursor-pointer p-0"
              style={{ color: C.text3 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.text2; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.text3; }}
              onClick={() => authClient.signOut().then(() => { window.location.href = '/login'; })}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile: avatar + new chat shortcut on the right */}
        <div className="sm:hidden ml-auto flex items-center gap-2">
          <Link
            href="/api/sessions/new-redirect"
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: C.accent, color: '#0c0c0f' }}
          >
            New chat
          </Link>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
            style={{ background: 'linear-gradient(135deg,#1a3e5c,#162d44)', color: C.accent, border: `1px solid ${C.borderStr}` }}
          >
            {initials}
          </div>
        </div>
      </header>

      {/* Scrollable content - full fluid width */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-4 pb-12">

          {/* Hero */}
          <div
            className="relative overflow-hidden rounded-xl border"
            style={{ background: C.card, borderColor: C.border }}
          >
            <div
              className="pointer-events-none absolute top-0 right-0 w-[500px] h-[220px]"
              style={{ background: 'radial-gradient(ellipse at 85% 0%, rgba(0,212,255,0.07) 0%, transparent 60%)', zIndex: 0 }}
            />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 p-6 sm:p-8">
              <div>
                <p className="text-[13px] mb-1.5" style={{ color: C.text2 }}>{greeting}</p>
                <h1
                  className="font-bold leading-none tracking-tight"
                  style={{ fontSize: 'clamp(28px, 5vw, 42px)', color: C.text }}
                >
                  {firstName}
                </h1>
                <p className="text-[13px] mt-2" style={{ color: C.text2 }}>
                  {totalSessions > 0
                    ? `${totalSessions} conversation${totalSessions !== 1 ? 's' : ''} in your workspace`
                    : 'Your workspace is ready'}
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => router.push(latestSessionId ? `/chat/${latestSessionId}` : '/api/sessions/new-redirect')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer border-none transition-all"
                  style={{ background: C.accent, color: '#0b0b0e' }}
                  onMouseEnter={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = '#22dcff';
                    b.style.boxShadow = '0 0 22px rgba(0,212,255,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = C.accent;
                    b.style.boxShadow = 'none';
                  }}
                >
                  {latestSessionId ? 'Continue' : 'Start a chat'}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </button>
                {latestSessionId && (
                  <Link
                    href="/api/sessions/new-redirect"
                    className="hidden sm:flex items-center px-5 py-2.5 rounded-lg text-[13px] font-medium border transition-all"
                    style={{ color: C.text2, background: 'transparent', borderColor: C.borderStr }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = C.surface;
                      el.style.color = C.text;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.background = 'transparent';
                      el.style.color = C.text2;
                    }}
                  >
                    New chat
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Metric cards: 2 col on mobile, 4 col on lg */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <Link
                key={m.label}
                href={m.href}
                className="flex flex-col gap-3 p-4 rounded-xl border transition-all"
                style={{ background: C.card, borderColor: C.border }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = `${m.color}40`;
                  el.style.background = `${m.color}08`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = C.border;
                  el.style.background = C.card;
                }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span
                    className="text-[28px] font-bold leading-none"
                    style={{ color: m.value > 0 ? C.text : C.text3 }}
                  >
                    {m.value}
                  </span>
                </div>
                <span className="text-[12px]" style={{ color: C.text2 }}>{m.label}</span>
              </Link>
            ))}
          </div>

          {/* Charts: stacked on mobile, side by side on md+ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

            {/* Activity bar chart - wider */}
            <div
              className="md:col-span-2 rounded-xl border p-4 sm:p-5 flex flex-col gap-3"
              style={{ background: C.card, borderColor: C.border }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold" style={{ color: C.text2 }}>Activity</span>
                <span className="text-[11px]" style={{ color: C.text3 }}>Last 7 days</span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={activityData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: C.text2, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: C.text3, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Bar dataKey="count" fill={C.accent} radius={[4, 4, 0, 0]} maxBarSize={48} />
                  <RechartsTooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    itemStyle={{ color: C.text2 }}
                    labelStyle={{ color: C.text, fontWeight: 600, marginBottom: '2px' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Workspace doughnut */}
            <div
              className="rounded-xl border p-4 sm:p-5 flex flex-col gap-3"
              style={{ background: C.card, borderColor: C.border }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold" style={{ color: C.text2 }}>Workspace</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: C.accentSoft, color: C.accent }}
                >
                  {configured}/4
                </span>
              </div>

              {/* Doughnut with centered label */}
              <div className="relative" style={{ height: '148px' }}>
                <ResponsiveContainer width="100%" height={148}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="72%"
                      dataKey="value"
                      strokeWidth={2}
                      stroke={C.bg}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={{ color: C.text2 }}
                      labelStyle={{ color: C.text }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[22px] font-bold leading-none" style={{ color: C.text }}>
                    {configured}
                  </span>
                  <span className="text-[10px] mt-0.5" style={{ color: C.text2 }}>configured</span>
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {donutLegend.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: item.color, opacity: item.value > 0 ? 1 : 0.2 }}
                    />
                    <span
                      className="text-[11px] truncate"
                      style={{ color: item.value > 0 ? C.text2 : C.text3 }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="ml-auto text-[11px] font-semibold shrink-0"
                      style={{ color: item.value > 0 ? C.text : C.text3 }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent conversations */}
          <div
            className="rounded-xl border"
            style={{ background: C.card, borderColor: C.border }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b"
              style={{ borderColor: C.border }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold" style={{ color: C.text }}>
                  Recent conversations
                </span>
                {totalSessions > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: C.accentSoft, color: C.accent }}
                  >
                    {totalSessions}
                  </span>
                )}
              </div>
              {totalSessions > 6 && (
                <Link
                  href="/dashboard"
                  className="text-[12px] transition-colors flex items-center gap-1"
                  style={{ color: C.text2 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.text; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C.text2; }}
                >
                  View all
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </Link>
              )}
            </div>

            <div className="p-4">
              {sessions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sessions.slice(0, 6).map((s, i) => (
                    <SessionCard key={s.id} session={s} index={i} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: C.surface }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] mb-1" style={{ color: C.text3 }}>No conversations yet</p>
                    <Link
                      href="/api/sessions/new-redirect"
                      className="text-[12px] font-medium"
                      style={{ color: C.accent }}
                    >
                      Start your first chat
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

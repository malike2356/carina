'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRelativeTimeLabel } from '@/hooks/useRelativeTimeLabel';

export interface LauncherActivitySession {
  id: string;
  title: string;
  lastMessageAt: Date | string | null;
}

/** Approx card height + gap; used to decide how many rows fill the panel. */
const SLOT_PX = 68;
const MAX_SESSIONS = 24;

function TimeAgo({ date }: { date: Date | string | null }) {
  return <>{useRelativeTimeLabel(date)}</>;
}

function ActivityCard({
  session,
  href,
  colors,
}: {
  session: LauncherActivitySession;
  href: string;
  colors: {
    card: string;
    border: string;
    hoverBorder: string;
    hoverBg: string;
    iconBg: string;
    icon: string;
    title: string;
    muted: string;
  };
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group shrink-0"
      style={{ background: colors.card, borderColor: colors.border }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = colors.hoverBorder;
        el.style.background = colors.hoverBg;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = colors.border;
        el.style.background = colors.card;
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: colors.iconBg, color: colors.icon }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: colors.title }}>
          {session.title || 'Conversation'}
        </div>
        <div className="text-[11px]" style={{ color: colors.muted }}>
          <TimeAgo date={session.lastMessageAt} />
        </div>
      </div>
      <svg
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.icon}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </Link>
  );
}

function useFillSlots(containerRef: React.RefObject<HTMLElement | null>) {
  const [slots, setSlots] = useState(8);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const height = el.clientHeight;
      setSlots(Math.max(3, Math.floor(height / SLOT_PX)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return slots;
}

export function LauncherActivityFeed({
  sessions,
  totalSessions,
  viewAllHref,
  sessionHref,
  empty,
  fillCta,
  colors,
}: {
  sessions: LauncherActivitySession[];
  totalSessions: number;
  viewAllHref: string;
  sessionHref: (id: string) => string;
  empty: ReactNode;
  /** Shown when there are not enough sessions to fill the panel height. */
  fillCta: ReactNode;
  colors: {
    heading: string;
    viewAll: string;
    card: string;
    border: string;
    hoverBorder: string;
    hoverBg: string;
    iconBg: string;
    icon: string;
    title: string;
    muted: string;
  };
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const slots = useFillSlots(listRef);
  const feed = sessions.slice(0, MAX_SESSIONS);
  const needsFill = feed.length > 0 && feed.length < slots;

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <p
          className="text-[11px] font-bold tracking-[0.14em] uppercase"
          style={{ color: colors.heading }}
        >
          Recent activity
        </p>
        {totalSessions > feed.length && (
          <Link
            href={viewAllHref}
            className="text-[11px] transition-colors"
            style={{ color: colors.viewAll }}
          >
            View all {totalSessions}
          </Link>
        )}
      </div>

      <div ref={listRef} className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
        {feed.length === 0 ? (
          empty
        ) : (
          <>
            <div className={`flex flex-col gap-2 min-h-0 ${needsFill ? 'shrink-0' : 'flex-1 overflow-y-auto'}`}>
              {feed.map((s) => (
                <ActivityCard
                  key={s.id}
                  session={s}
                  href={sessionHref(s.id)}
                  colors={colors}
                />
              ))}
            </div>
            {needsFill ? (
              <div className="flex-1 min-h-0 flex flex-col">{fillCta}</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export const LAUNCHER_ACTIVITY_MAX = MAX_SESSIONS;

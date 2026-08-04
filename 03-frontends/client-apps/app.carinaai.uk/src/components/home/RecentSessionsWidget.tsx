'use client';

import Link from 'next/link';
import { MessageSquare, ArrowRight } from 'lucide-react';

type Session = {
  id: string;
  title: string;
  lastMessageAt: string | null;
  model: string;
};

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function SessionCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 h-4 w-3/4 rounded bg-elevated" />
      <div className="h-3 w-1/4 rounded bg-elevated" />
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  return (
    <Link
      href={`/chat/${session.id}`}
      className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40 hover:bg-elevated"
    >
      <span className="truncate text-sm font-medium text-text-primary">
        {session.title || 'Untitled session'}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        {session.lastMessageAt && (
          <span className="text-xs text-text-secondary">{relativeTime(session.lastMessageAt)}</span>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

type RecentSessionsWidgetProps = {
  sessions: Session[];
  loading: boolean;
};

export function RecentSessionsWidget({ sessions, loading }: RecentSessionsWidgetProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3 w-3 text-text-muted" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Recent sessions
          </h2>
        </div>
        <Link
          href="/chat"
          className="text-xs text-text-muted transition-colors hover:text-text-secondary"
        >
          See all
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-text-secondary">No sessions yet. Start one to get going.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.slice(0, 5).map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}

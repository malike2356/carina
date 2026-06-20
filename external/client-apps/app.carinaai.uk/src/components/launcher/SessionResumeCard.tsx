'use client';

import Link from 'next/link';
import { ChevronRight, MessageSquare } from 'lucide-react';

interface Session {
  id: string;
  title: string;
  lastMessageAt: Date | string | null;
}

function timeAgo(date: Date | string | null): string {
  if (!date) return 'just now';
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

const SESSION_COLORS = ['#3b82f6', '#9b59f5', '#f59e0b', '#16c97e', '#00d4ff', '#ec4899'];

export function SessionResumeCard({ session, index }: { session: Session; index: number }) {
  const color = SESSION_COLORS[index % SESSION_COLORS.length];
  const initial = session.title?.[0]?.toUpperCase() ?? 'C';

  return (
    <Link
      href={`/chat/${session.id}`}
      className="flex items-center gap-3.5 px-4 py-3.5 rounded-[10px] border transition-colors group"
      style={{ background: '#0d1829', borderColor: '#1a2b45' }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-base"
        style={{ background: color }}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#e8f0f8' }}>
          {session.title || 'Untitled chat'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#6b8aaa' }}>
          Chat session
        </p>
      </div>
      <span className="text-xs whitespace-nowrap shrink-0" style={{ color: '#6b8aaa' }}>
        {timeAgo(session.lastMessageAt)}
      </span>
      <ChevronRight size={16} style={{ color: '#4a6a8a' }} className="shrink-0" />
    </Link>
  );
}

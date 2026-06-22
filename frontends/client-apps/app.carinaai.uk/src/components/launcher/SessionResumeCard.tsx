'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatSessionTimeAgo } from '@/lib/relative-time';
import { useHydrated } from '@/hooks/useHydrated';

interface Session {
  id: string;
  title: string;
  lastMessageAt: Date | string | null;
}

const SESSION_COLORS = ['#3b82f6', '#9b59f5', '#f59e0b', '#16c97e', '#00d4ff', '#ec4899'];

function SessionTimeAgo({ date }: { date: Date | string | null }) {
  const hydrated = useHydrated();
  const [label, setLabel] = useState('...');

  useEffect(() => {
    setLabel(formatSessionTimeAgo(date));
  }, [date]);

  return <>{hydrated ? label : '...'}</>;
}

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
        <SessionTimeAgo date={session.lastMessageAt} />
      </span>
      <ChevronRight size={16} style={{ color: '#4a6a8a' }} className="shrink-0" />
    </Link>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SessionResumeCard } from './SessionResumeCard';
import { LauncherStatusBar } from './LauncherStatusBar';
import { useGreeting } from '@/hooks/useRelativeTimeLabel';

interface Session {
  id: string;
  title: string;
  lastMessageAt: Date | string | null;
}

interface Props {
  userName: string;
  sessions: Session[];
  totalSessions: number;
  latestSessionId: string | null;
  scoutPaired: boolean;
  onContinue?: () => void;
  onExpand?: () => void;
}

export function LauncherPrimary({ userName, sessions, totalSessions, latestSessionId, scoutPaired, onContinue, onExpand }: Props) {
  const router = useRouter();
  const greeting = useGreeting();
  const firstName = userName.split(' ')[0] || 'there';

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
      return;
    }
    if (latestSessionId) {
      router.push(`/chat/${latestSessionId}`);
    } else {
      router.push('/api/sessions/new-redirect');
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden" style={{ background: '#060c18', color: '#e8f0f8', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Title bar */}
      <div className="flex items-center px-5 h-11 shrink-0 border-b" style={{ background: '#060c18', borderColor: '#1a2b45' }}>
        <div className="flex gap-2">
          <span className="w-[13px] h-[13px] rounded-full" style={{ background: '#ff5f57' }} />
          <span className="w-[13px] h-[13px] rounded-full" style={{ background: '#ffbd2e' }} />
          <span className="w-[13px] h-[13px] rounded-full" style={{ background: '#28ca41' }} />
        </div>
        <span className="ml-4 text-[11px] font-medium tracking-[0.12em] uppercase" style={{ color: '#4a6a8a' }}>
          CARINA LAUNCHER
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#16c97e', boxShadow: '0 0 6px #16c97e' }} />
          <span className="text-[11px] tracking-[0.08em]" style={{ color: '#16c97e' }}>ONLINE</span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '380px 1fr' }}>
        {/* Left panel */}
        <button
          type="button"
          onClick={onExpand}
          className="flex flex-col justify-center gap-10 p-12 border-r text-left cursor-pointer border-none"
          style={{ borderColor: '#1a2b45', background: 'transparent' }}
          aria-label="Expand launcher sidebar"
        >
          <div className="flex flex-col items-start gap-2.5">
            <Image
              src="/carina_logo_1.png"
              alt="Carina"
              width={120}
              height={120}
              className="object-contain"
              priority
            />
            <span className="text-[38px] font-bold leading-none tracking-tight" style={{ color: '#e8f0f8', letterSpacing: '-0.02em' }}>
              Carina
            </span>
            <span className="text-[10px] font-medium tracking-[0.15em] uppercase" style={{ color: '#4a6a8a' }}>
              ONE MEMORY. ONE AGENT. EVERYWHERE.
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-1.5" style={{ color: '#e8f0f8' }}>
              {greeting}, {firstName}.
            </h2>
            <p className="text-sm" style={{ color: '#6b8aaa' }}>
              {totalSessions} conversation{totalSessions !== 1 ? 's' : ''} in your workspace.
            </p>
          </div>
        </button>

        {/* Right panel */}
        <div className="flex items-center justify-center p-12 overflow-y-auto">
          <div className="w-full max-w-[440px] flex flex-col gap-5">
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase m-0" style={{ color: '#4a6a8a' }}>
              PICK UP WHERE YOU LEFT OFF
            </p>

            <div className="flex flex-col gap-2">
              {sessions.length > 0
                ? sessions.map((s, i) => <SessionResumeCard key={s.id} session={s} index={i} />)
                : <p className="text-[13px]" style={{ color: '#4a6a8a' }}>No conversations yet. Start one below.</p>
              }
            </div>

            {totalSessions > 3 && (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-[13px] self-start"
                style={{ color: '#00d4ff', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                View all conversations
                <span className="text-[11px] px-2 py-0.5 rounded-[10px]" style={{ background: '#1a2b45', color: '#6b8aaa' }}>
                  {totalSessions}
                </span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleContinue}
              className="flex items-center justify-center gap-3 w-full py-[18px] px-6 rounded-lg text-sm font-bold tracking-[0.1em] uppercase cursor-pointer border-none transition-all mt-2"
              style={{ background: '#00d4ff', color: '#060c18' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#33ddff'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(0,212,255,0.35)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#00d4ff'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
            >
              {latestSessionId ? 'CONTINUE WORK' : 'START NEW CHAT'} <span>&#8594;</span>
            </button>
          </div>
        </div>
      </div>

      <LauncherStatusBar scoutPaired={scoutPaired} />
    </div>
  );
}

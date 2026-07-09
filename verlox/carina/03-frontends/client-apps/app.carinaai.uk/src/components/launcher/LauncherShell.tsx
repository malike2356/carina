'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LauncherData } from '@/lib/launcher-data';
import { WorkspaceOnboardingCard } from '@/components/settings/WorkspaceOnboardingCard';
import { LauncherExpanded } from './LauncherExpanded';
import { LauncherPrimary } from './LauncherPrimary';
import { LauncherWithSidebar, type LauncherNavPath } from './LauncherSidebar';
import { SessionResumeCard } from './SessionResumeCard';

type LauncherMode = 'primary' | 'sidebar' | 'expanded';

interface Props extends LauncherData {}

function LauncherHomeContent({
  data,
  onContinue,
}: {
  data: LauncherData;
  onContinue: () => void;
}) {
  return (
    <div className="w-full max-w-[440px] flex flex-col gap-5">
      <WorkspaceOnboardingCard
        keyCount={data.keyCount}
        activeSkillPacks={data.activeSkillPacks}
      />
      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase m-0" style={{ color: '#4a6a8a' }}>
        PICK UP WHERE YOU LEFT OFF
      </p>
      <div className="flex flex-col gap-2">
        {data.sessions.length > 0
          ? data.sessions.slice(0, 3).map((s, i) => (
              <SessionResumeCard key={s.id} session={s} index={i} />
            ))
          : (
            <p className="text-[13px]" style={{ color: '#4a6a8a' }}>No conversations yet. Start one below.</p>
          )}
      </div>
      {data.totalSessions > 3 && (
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-[13px] self-start"
          style={{ color: '#00d4ff' }}
        >
          View all conversations
          <span className="text-[11px] px-2 py-0.5 rounded-[10px]" style={{ background: '#1a2b45', color: '#6b8aaa' }}>
            {data.totalSessions}
          </span>
        </Link>
      )}
      <button
        type="button"
        onClick={onContinue}
        className="flex items-center justify-center gap-3 w-full py-[18px] px-6 rounded-lg text-sm font-bold tracking-[0.1em] uppercase cursor-pointer border-none transition-all mt-2"
        style={{ background: '#00d4ff', color: '#060c18' }}
      >
        {data.latestSessionId ? 'CONTINUE WORK' : 'START NEW CHAT'} <span>&#8594;</span>
      </button>
    </div>
  );
}

export function LauncherShell(data: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<LauncherMode>('expanded');
  const [activePath, setActivePath] = useState<LauncherNavPath>('/launcher');

  const handleContinue = () => {
    if (data.latestSessionId) {
      router.push(`/chat/${data.latestSessionId}`);
    } else {
      router.push('/api/sessions/new-redirect');
    }
  };

  const handleNavigate = (path: LauncherNavPath) => {
    setActivePath(path);
    if (path === '/workspaces') {
      setMode('expanded');
    } else {
      setMode('sidebar');
    }
  };

  if (mode === 'primary') {
    return (
      <LauncherPrimary
        userName={data.userName}
        sessions={data.sessions.slice(0, 3)}
        totalSessions={data.totalSessions}
        latestSessionId={data.latestSessionId}
        scoutPaired={data.scoutPaired}
        onContinue={handleContinue}
        onExpand={() => {
          setActivePath('/launcher');
          setMode('sidebar');
        }}
      />
    );
  }

  if (mode === 'expanded' || activePath === '/workspaces') {
    return (
      <LauncherExpanded
        userName={data.userName}
        userEmail={data.userEmail}
        sessions={data.sessions}
        totalSessions={data.totalSessions}
        latestSessionId={data.latestSessionId}
        memoryCount={data.memoryCount}
        skillCount={data.skillCount}
        keyCount={data.keyCount}
        taskCount={data.taskCount}
        activeSkillPacks={data.activeSkillPacks}
        sessionDates={data.sessionDates}
      />
    );
  }

  return (
    <LauncherWithSidebar
      activePath={activePath}
      userName={data.userName}
      scoutPaired={data.scoutPaired}
      onNavigate={handleNavigate}
    >
      <LauncherHomeContent data={data} onContinue={handleContinue} />
    </LauncherWithSidebar>
  );
}

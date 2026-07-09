'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GreetingBar } from '@/components/home/GreetingBar';
import { RecentSessionsWidget } from '@/components/home/RecentSessionsWidget';
import { BrainStatsWidget } from '@/components/home/BrainStatsWidget';
import { TasksWidget } from '@/components/home/TasksWidget';
import { DiscoveryCard } from '@/components/home/DiscoveryCard';
import { WelcomeEmptyState } from '@/components/home/WelcomeEmptyState';

type Session = { id: string; title: string; lastMessageAt: string | null; model: string };
type Task = { id: string; name: string; status: string; type: string };

type WorkspaceHomeProps = {
  workspaceId: string;
  userName: string;
};

export function WorkspaceHome({ workspaceId, userName }: WorkspaceHomeProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [customSkillCount, setCustomSkillCount] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch('/api/sessions').then((r) => r.json()),
      fetch('/api/memories').then((r) => r.json()),
      fetch('/api/skills').then((r) => r.json()),
      fetch('/api/tasks').then((r) => r.json()),
    ]).then(([sessRes, memRes, skillRes, taskRes]) => {
      if (cancelled) return;

      if (sessRes.status === 'fulfilled') {
        const data = sessRes.value as { data?: Session[] };
        setSessions(data.data ?? []);
      }
      if (memRes.status === 'fulfilled') {
        const data = memRes.value as { data?: unknown[] };
        setMemoryCount((data.data ?? []).length);
      }
      if (skillRes.status === 'fulfilled') {
        const data = skillRes.value as { data?: Array<{ isCustom?: boolean }> };
        setCustomSkillCount((data.data ?? []).filter((s) => s.isCustom).length);
      }
      if (taskRes.status === 'fulfilled') {
        const data = taskRes.value as { data?: Task[] };
        setTasks(data.data ?? []);
      }

      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleNewSession = useCallback(async () => {
    const res = await fetch('/api/sessions', { method: 'POST' });
    const data = (await res.json()) as { data?: { id: string } };
    if (data.data?.id) {
      router.push(`/chat/${data.data.id}`);
      document.dispatchEvent(new Event('refresh-sessions'));
    }
  }, [router]);

  const handleSuggestion = useCallback(
    async (text: string) => {
      const res = await fetch('/api/sessions', { method: 'POST' });
      const data = (await res.json()) as { data?: { id: string } };
      if (data.data?.id) {
        router.push(`/chat/${data.data.id}?prefill=${encodeURIComponent(text)}`);
        document.dispatchEvent(new Event('refresh-sessions'));
      }
    },
    [router],
  );

  const isEmpty = !loading && sessions.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-6 pt-6 pb-4">
          <GreetingBar userName={userName} onNewSession={handleNewSession} />
        </div>
        <WelcomeEmptyState onSuggestionClick={handleSuggestion} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6 pb-24">
      <GreetingBar userName={userName} onNewSession={handleNewSession} loading={loading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
        <RecentSessionsWidget sessions={sessions} loading={loading} />
        <div className="space-y-4">
          <BrainStatsWidget
            memoryCount={memoryCount}
            skillCount={customSkillCount}
            loading={loading}
          />
          <TasksWidget tasks={tasks} loading={loading} />
        </div>
      </div>

      <DiscoveryCard
        sessionCount={sessions.length}
        memoryCount={memoryCount}
        skillCount={customSkillCount}
      />
    </div>
  );
}

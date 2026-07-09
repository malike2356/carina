'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  if (hour >= 18 && hour < 22) return 'Good evening';
  return 'Working late';
}

type GreetingBarProps = {
  userName: string;
  onNewSession: () => void;
  loading?: boolean;
};

export function GreetingBar({ userName, onNewSession, loading }: GreetingBarProps) {
  const displayName = userName.split(' ')[0] || 'there';

  return (
    <div className="flex items-center justify-between pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          {getGreeting()}, {displayName}.
        </h1>
        <p className="mt-1 text-sm text-text-secondary">Your agent is ready.</p>
      </div>
      <button
        type="button"
        onClick={onNewSession}
        disabled={loading}
        className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        New session
      </button>
    </div>
  );
}

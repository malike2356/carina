'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

type Trigger = {
  id: string;
  priority: number;
  condition: (s: DiscoveryState) => boolean;
  title: string;
  body: (s: DiscoveryState) => string;
  action: { label: string; href: string };
  accent: 'amber' | 'cyan';
};

type DiscoveryState = {
  sessionCount: number;
  memoryCount: number;
  skillCount: number;
};

const TRIGGERS: Trigger[] = [
  {
    id: 'brain_discovery',
    priority: 1,
    condition: (s) => s.memoryCount >= 10,
    title: 'Your agent has been remembering',
    body: (s) => `It has built up ${s.memoryCount} memories. See how they connect.`,
    action: { label: 'Open memory library', href: '/library' },
    accent: 'cyan',
  },
  {
    id: 'skills_empty',
    priority: 2,
    condition: (s) => s.sessionCount >= 5 && s.skillCount === 0,
    title: 'Your agent has no reusable skills yet',
    body: () => 'After several sessions it is worth adding skills it can reuse consistently.',
    action: { label: 'Add a skill', href: '/packs' },
    accent: 'cyan',
  },
];

const STORAGE_KEY = 'keprix_discovery_dismissed';
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function readDismissed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function writeDismissed(dismissed: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
  } catch {
    // ignore
  }
}

type DiscoveryCardProps = DiscoveryState;

export function DiscoveryCard({ sessionCount, memoryCount, skillCount }: DiscoveryCardProps) {
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const state: DiscoveryState = { sessionCount, memoryCount, skillCount };
  const now = Date.now();

  const activeTrigger = TRIGGERS.sort((a, b) => a.priority - b.priority).find((t) => {
    const dismissedAt = dismissed[t.id];
    const isStillDismissed = dismissedAt && now - dismissedAt < DISMISS_DURATION_MS;
    return t.condition(state) && !isStillDismissed;
  });

  if (!activeTrigger) return null;

  function dismiss() {
    if (!activeTrigger) return;
    const next = { ...dismissed, [activeTrigger.id]: Date.now() };
    setDismissed(next);
    writeDismissed(next);
  }

  const borderColor = activeTrigger.accent === 'amber' ? 'border-l-amber-500' : 'border-l-accent';

  return (
    <div
      className={`mt-6 rounded-lg border border-border bg-surface p-4 border-l-4 ${borderColor}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{activeTrigger.title}</p>
          <p className="mt-1 text-xs text-text-muted">{activeTrigger.body(state)}</p>
          <Link
            href={activeTrigger.action.href}
            onClick={dismiss}
            className="mt-4 inline-flex items-center rounded-md bg-elevated px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-border"
          >
            {activeTrigger.action.label}
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss this suggestion"
          className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-elevated hover:text-text-secondary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

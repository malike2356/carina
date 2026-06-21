'use client';

import { Activity } from 'lucide-react';

interface HeartbeatNoticeProps {
  visible: boolean;
}

export function HeartbeatNotice({ visible }: HeartbeatNoticeProps) {
  if (!visible) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
      <Activity className="h-3.5 w-3.5 animate-pulse text-accent" />
      <span>Carina is checking in.</span>
    </div>
  );
}

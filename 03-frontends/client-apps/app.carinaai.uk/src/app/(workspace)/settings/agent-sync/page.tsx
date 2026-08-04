'use client';

import Link from 'next/link';
import { AgentSyncSettings } from '@/components/settings/AgentSyncSettings';

export default function AgentSyncSettingsPage() {
  return (
    <div className="mx-auto max-w-[90rem] space-y-4 p-6">
      <Link href="/settings?section=brain" className="text-xs text-text-muted hover:text-text-primary">
        Back to Brain settings
      </Link>
      <AgentSyncSettings />
    </div>
  );
}

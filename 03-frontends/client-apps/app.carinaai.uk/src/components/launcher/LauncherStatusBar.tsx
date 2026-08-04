'use client';

import { Lock, RefreshCw, Shield } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

interface Props {
  scoutPaired?: boolean;
}

export function LauncherStatusBar({ scoutPaired = false }: Props) {
  return (
    <div className="flex items-center gap-6 px-6 h-10 border-t shrink-0"
      style={{ background: '#060c18', borderColor: '#1a2b45' }}>
      <div className="flex items-center gap-1.5 text-[11px]"
        style={{ color: scoutPaired ? '#16c97e' : '#6b8aaa' }}>
        <span className="w-2 h-2 rounded-full shrink-0"
          style={{ background: scoutPaired ? '#16c97e' : '#4a6a8a', boxShadow: scoutPaired ? '0 0 6px #16c97e' : 'none' }} />
        Scout {scoutPaired ? 'Protected' : 'Not paired'}
      </div>
      <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#6b8aaa' }}>
        <Lock size={11} />
        Encrypted
      </div>
      <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#6b8aaa' }}>
        <RefreshCw size={11} />
        Synced
      </div>
      <div className="ml-auto flex items-center gap-4">
        <span className="text-[11px]" style={{ color: '#4a6a8a' }}>Carina Cloud</span>
        <button
          type="button"
          className="text-[11px] hover:underline bg-transparent border-none cursor-pointer p-0"
          style={{ color: '#6b8aaa' }}
          onClick={() => authClient.signOut().then(() => { window.location.href = '/login'; })}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

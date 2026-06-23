'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type WorkspaceProfileSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isBuiltin: boolean;
};

interface ProfileSwitcherProps {
  sessionId: string;
  activeProfileId?: string | null;
  onProfileChange?: (profile: WorkspaceProfileSummary | null) => void;
}

export function ProfileSwitcher({
  sessionId,
  activeProfileId,
  onProfileChange,
}: ProfileSwitcherProps) {
  const [profiles, setProfiles] = useState<WorkspaceProfileSummary[]>([]);
  const [selectedId, setSelectedId] = useState(activeProfileId ?? '');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedId(activeProfileId ?? '');
  }, [activeProfileId]);

  useEffect(() => {
    void fetch('/api/workspace/profiles', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.data ?? []) as WorkspaceProfileSummary[];
        setProfiles(rows);
      })
      .catch(() => setProfiles([]));
  }, []);

  const activeProfile =
    profiles.find((profile) => profile.id === selectedId) ??
    profiles.find((profile) => profile.slug === 'default') ??
    null;

  async function selectProfile(profile: WorkspaceProfileSummary | null) {
    if (!profile || profile.id === selectedId) {
      setOpen(false);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/workspace/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate_session',
          profileId: profile.id,
          sessionId,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Unable to switch profile');
      }
      setSelectedId(profile.id);
      onProfileChange?.(profile);
      setOpen(false);
    } catch {
      // keep current selection on failure
    } finally {
      setBusy(false);
    }
  }

  if (profiles.length === 0) return null;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2 text-[11px] font-normal"
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
      >
        <UserCog className="h-3.5 w-3.5" />
        <span className="max-w-[9rem] truncate">{activeProfile?.name ?? 'Default'}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] rounded-md border border-border bg-surface p-1 shadow-lg">
          {profiles.map((profile) => {
            const active = profile.id === selectedId;
            return (
              <button
                key={profile.id}
                type="button"
                className={cn(
                  'flex w-full flex-col rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-elevated',
                  active && 'bg-accent-dim/30 text-accent',
                )}
                onClick={() => void selectProfile(profile)}
              >
                <span className="font-medium">{profile.name}</span>
                {profile.description ? (
                  <span className="mt-0.5 text-[10px] text-text-muted">{profile.description}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

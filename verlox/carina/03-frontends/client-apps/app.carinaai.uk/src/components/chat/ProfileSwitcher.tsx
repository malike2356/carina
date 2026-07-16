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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(activeProfileId ?? '');
  }, [activeProfileId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void fetch('/api/workspace/profiles', { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json()) as { data?: WorkspaceProfileSummary[]; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? 'Unable to load profiles');
        }
        return (data.data ?? []) as WorkspaceProfileSummary[];
      })
      .then((rows) => {
        if (!cancelled) setProfiles(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProfiles([]);
          setLoadError(error instanceof Error ? error.message : 'Unable to load profiles');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeProfile = profiles.find((profile) => profile.id === selectedId) ?? null;
  const usingDefault = !selectedId;

  async function applySessionProfile(profile: WorkspaceProfileSummary | null) {
    const nextProfileId = profile?.id ?? '';
    if (nextProfileId === selectedId) {
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
          profileId: nextProfileId,
          sessionId,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Unable to switch profile');
      }
      setSelectedId(nextProfileId);
      onProfileChange?.(profile);
      setOpen(false);
    } catch {
      // keep current selection on failure
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2 text-[11px] font-normal"
        disabled
      >
        <UserCog className="h-3.5 w-3.5" />
        <span className="max-w-[9rem] truncate">Profiles...</span>
      </Button>
    );
  }

  if (profiles.length === 0) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2 text-[11px] font-normal text-text-muted"
        disabled
        title={loadError ?? 'No workspace profiles available'}
      >
        <UserCog className="h-3.5 w-3.5" />
        <span className="max-w-[9rem] truncate">Profile</span>
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2 text-[11px] font-normal"
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
        title={loadError ?? undefined}
      >
        <UserCog className="h-3.5 w-3.5" />
        <span className="max-w-[9rem] truncate">{activeProfile?.name ?? 'Default'}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] rounded-md border border-border bg-surface p-1 shadow-lg">
          <button
            type="button"
            className={cn(
              'flex w-full flex-col rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-elevated',
              usingDefault && 'bg-accent-dim/30 text-accent',
            )}
            onClick={() => void applySessionProfile(null)}
          >
            <span className="font-medium">Default</span>
            <span className="mt-0.5 text-[10px] text-text-muted">
              Standard workspace assistant with your memories and skills.
            </span>
          </button>
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
                onClick={() => void applySessionProfile(profile)}
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

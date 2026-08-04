'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PropertyChannelRun } from './types';

export function channelIdFromRun(run: PropertyChannelRun | null): string | null {
  if (!run) return null;
  const provisioned = run.context?.['channel-provision'] as { channelId?: string } | undefined;
  return provisioned?.channelId ?? run.input.channelId ?? null;
}

/**
 * Loads the workspace's most recently created YouTube Channel run. This
 * vertical slice supports one active channel per workspace, so "the" run is
 * the newest one returned by the list endpoint.
 */
export function useYouTubeChannelRun() {
  const [run, setRun] = useState<PropertyChannelRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/aiva/youtube-channel');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Could not load your YouTube channel');
      }
      const data = (await res.json()) as { runs?: PropertyChannelRun[] };
      const runs = data.runs ?? [];
      const latest = [...runs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
      setRun(latest ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your YouTube channel');
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { run, loading, error, reload, channelId: channelIdFromRun(run) };
}

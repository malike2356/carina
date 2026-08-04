'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResolvedWorkspaceFeature, WorkspaceFeatureKey } from '@/lib/workspace-features';

type FeaturesState = {
  loading: boolean;
  features: ResolvedWorkspaceFeature[];
  byKey: Partial<Record<WorkspaceFeatureKey, ResolvedWorkspaceFeature>>;
  refresh: () => Promise<void>;
};

let cachedFeatures: ResolvedWorkspaceFeature[] | null = null;
let inflight: Promise<ResolvedWorkspaceFeature[]> | null = null;

async function fetchFeatures(): Promise<ResolvedWorkspaceFeature[]> {
  if (cachedFeatures) return cachedFeatures;
  if (inflight) return inflight;
  inflight = fetch('/api/workspace/settings/features')
    .then(async (res) => {
      const body = (await res.json()) as { features?: ResolvedWorkspaceFeature[] };
      if (!res.ok) throw new Error('Failed to load features');
      cachedFeatures = body.features ?? [];
      return cachedFeatures;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateWorkspaceFeaturesCache() {
  cachedFeatures = null;
}

export function useWorkspaceFeatures(): FeaturesState {
  const [features, setFeatures] = useState<ResolvedWorkspaceFeature[]>(cachedFeatures ?? []);
  const [loading, setLoading] = useState(!cachedFeatures);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      invalidateWorkspaceFeaturesCache();
      const next = await fetchFeatures();
      setFeatures(next);
    } catch {
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchFeatures()
      .then((next) => {
        if (!cancelled) setFeatures(next);
      })
      .catch(() => {
        if (!cancelled) setFeatures([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byKey = useMemo(() => {
    const map: Partial<Record<WorkspaceFeatureKey, ResolvedWorkspaceFeature>> = {};
    for (const feature of features) map[feature.key] = feature;
    return map;
  }, [features]);

  return { loading, features, byKey, refresh };
}

export function useWorkspaceFeatureEnabled(
  key: WorkspaceFeatureKey,
  fallback = true,
): { loading: boolean; enabled: boolean } {
  const { loading, byKey } = useWorkspaceFeatures();
  return {
    loading,
    enabled: byKey[key]?.enabled ?? fallback,
  };
}

'use client';

import { useEffect, useState } from 'react';
import type { CloudCapabilities } from '@/lib/cloud-capabilities';

type CloudCapabilitiesState = {
  capabilities: CloudCapabilities | null;
  loading: boolean;
};

const DEFAULT: CloudCapabilitiesState = {
  capabilities: null,
  loading: true,
};

export function useCloudCapabilities(): CloudCapabilitiesState {
  const [state, setState] = useState<CloudCapabilitiesState>(DEFAULT);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/capabilities', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { data?: CloudCapabilities }) => {
        if (cancelled) return;
        setState({
          capabilities: data.data ?? null,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

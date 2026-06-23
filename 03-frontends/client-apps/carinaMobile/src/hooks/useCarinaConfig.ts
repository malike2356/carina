import { useCallback, useEffect, useState } from 'react';
import type { ProvidersResponse } from '@/api/types';
import { useAuth } from '@/store/auth-store';

interface CarinaConfigState {
  loading: boolean;
  error: string | null;
  providers: ProvidersResponse | null;
}

export function useCarinaConfig(): CarinaConfigState & { reload: () => Promise<void> } {
  const { client, ready } = useAuth();
  const [state, setState] = useState<CarinaConfigState>({
    loading: true,
    error: null,
    providers: null,
  });

  const reload = useCallback(async () => {
    if (!client) {
      setState({ loading: false, error: null, providers: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const providers = await client.providers();
      setState({ loading: false, error: null, providers });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ loading: false, error: message, providers: null });
    }
  }, [client]);

  useEffect(() => {
    if (!ready) return;
    void reload();
  }, [ready, reload]);

  return { ...state, reload };
}

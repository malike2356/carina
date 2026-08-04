import { useCallback, useState } from 'react';
import {
  AivaApiError,
  fetchAivaSubscriptionStatus,
  listAivaWorkers,
  type AivaSubscriptionStatus,
  type AivaWorkerSummary,
} from '@/api/aiva-client';
import { isApiAuthError } from '@/lib/cloud-features';
import type { GatewayAuthOptions } from '@/lib/gateway-auth';

export type AivaWorkspacePhase = 'idle' | 'loading' | 'ready' | 'error';

export interface AivaWorkspaceState {
  phase: AivaWorkspacePhase;
  workers: AivaWorkerSummary[];
  subscription: AivaSubscriptionStatus | null;
  error: string | null;
  sessionExpired: boolean;
  planGate: boolean;
  refreshing: boolean;
}

const INITIAL: AivaWorkspaceState = {
  phase: 'idle',
  workers: [],
  subscription: null,
  error: null,
  sessionExpired: false,
  planGate: false,
  refreshing: false,
};

export function useAivaWorkspace(baseUrl: string | null, auth: GatewayAuthOptions | null) {
  const [state, setState] = useState<AivaWorkspaceState>(INITIAL);

  const refresh = useCallback(async () => {
    if (!baseUrl || !auth?.apiKey) {
      setState({
        ...INITIAL,
        phase: 'error',
        error: 'Sign in to load Aiva workers.',
        sessionExpired: true,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      phase: prev.phase === 'ready' ? 'ready' : 'loading',
      refreshing: prev.phase === 'ready',
      error: null,
      sessionExpired: false,
      planGate: false,
    }));

    try {
      const [workers, subscription] = await Promise.all([
        listAivaWorkers(baseUrl, auth),
        fetchAivaSubscriptionStatus(baseUrl, auth).catch(() => null),
      ]);
      setState({
        phase: 'ready',
        workers,
        subscription,
        error: null,
        sessionExpired: false,
        planGate: false,
        refreshing: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof AivaApiError ? err.status : 0;
      setState({
        phase: 'error',
        workers: [],
        subscription: null,
        error: message,
        sessionExpired: isApiAuthError(message) || status === 401,
        planGate: status === 403,
        refreshing: false,
      });
    }
  }, [auth, baseUrl]);

  return { ...state, refresh };
}

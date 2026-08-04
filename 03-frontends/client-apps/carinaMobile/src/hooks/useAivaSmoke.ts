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

export type AivaSmokePhase = 'idle' | 'loading' | 'ready' | 'error';

export interface AivaSmokeState {
  phase: AivaSmokePhase;
  workers: AivaWorkerSummary[];
  subscription: AivaSubscriptionStatus | null;
  error: string | null;
  sessionExpired: boolean;
  planGate: boolean;
}

const INITIAL: AivaSmokeState = {
  phase: 'idle',
  workers: [],
  subscription: null,
  error: null,
  sessionExpired: false,
  planGate: false,
};

export function useAivaSmoke(baseUrl: string | null, auth: GatewayAuthOptions | null) {
  const [state, setState] = useState<AivaSmokeState>(INITIAL);

  const refresh = useCallback(async () => {
    if (!baseUrl || !auth?.apiKey) {
      setState({
        ...INITIAL,
        phase: 'error',
        error: 'Sign in to Carina Cloud to load Aiva employees.',
        sessionExpired: true,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      phase: 'loading',
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
      });
    }
  }, [auth, baseUrl]);

  return { ...state, refresh };
}

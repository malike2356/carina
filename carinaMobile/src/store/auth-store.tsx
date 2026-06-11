import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CarinaClient } from '@/api/carina-client';
import type { HostedUser, InstanceConfig } from '@/api/types';
import { authFromInstance, type GatewayAuthOptions } from '@/lib/gateway-auth';
import { loadApiKey } from './api-key-store';
import { loadInstanceConfig } from './instance-store';

interface AuthState {
  ready: boolean;
  instance: InstanceConfig | null;
  user: HostedUser | null;
  client: CarinaClient | null;
  apiKey: string | null;
  gatewayAuth: GatewayAuthOptions | null;
}

interface AuthContextValue extends AuthState {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setInstance: (instance: InstanceConfig) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ready: false,
    instance: null,
    user: null,
    client: null,
    apiKey: null,
    gatewayAuth: null,
  });

  const buildClientState = useCallback(async (instance: InstanceConfig) => {
    const apiKey =
      instance.mode === 'self-hosted' ? await loadApiKey(instance.baseUrl) : null;
    const gatewayAuth = authFromInstance(instance.mode, apiKey);
    const client = new CarinaClient({
      baseUrl: instance.baseUrl,
      credentials: gatewayAuth.credentials,
      apiKey: gatewayAuth.apiKey ?? undefined,
    });
    return { apiKey, gatewayAuth, client };
  }, []);

  const refresh = useCallback(async () => {
    const instance = await loadInstanceConfig();
    const { apiKey, gatewayAuth, client } = await buildClientState(instance);

    let user: HostedUser | null = null;
    if (instance.mode === 'cloud') {
      try {
        const ctx = await client.hostedContext();
        user = ctx.user;
      } catch {
        user = null;
      }
    }

    setState({ ready: true, instance, user, client, apiKey, gatewayAuth });
  }, [buildClientState]);

  const setInstance = useCallback(
    (instance: InstanceConfig) => {
      void buildClientState(instance).then(({ apiKey, gatewayAuth, client }) => {
        setState((prev) => ({
          ...prev,
          instance,
          client,
          apiKey,
          gatewayAuth,
        }));
      });
    },
    [buildClientState],
  );

  const signOut = useCallback(async () => {
    if (state.client && state.instance?.mode === 'cloud') {
      try {
        await state.client.logout();
      } catch {
        // ignore network errors on logout
      }
    }
    await refresh();
  }, [state.client, state.instance?.mode, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ ...state, refresh, signOut, setInstance }),
    [state, refresh, signOut, setInstance],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CarinaClient } from '@/api/carina-client';
import type { HostedUser, InstanceConfig } from '@/api/types';
import { authFromInstance, type GatewayAuthOptions } from '@/lib/gateway-auth';
import { isApiAuthError } from '@/lib/cloud-features';
import { loadApiKey } from './api-key-store';
import {
  clearCloudSessionToken,
  loadCloudSessionToken,
} from './cloud-session-store';
import { loadDeviceToken } from './device-token-store';
import { ensureSessionId, loadInstanceConfig } from './instance-store';

interface AuthState {
  ready: boolean;
  instance: InstanceConfig | null;
  user: HostedUser | null;
  client: CarinaClient | null;
  apiKey: string | null;
  gatewayAuth: GatewayAuthOptions | null;
  cloudSessionExpired: boolean;
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
    cloudSessionExpired: false,
  });

  const buildClientState = useCallback(async (instance: InstanceConfig) => {
    const apiKey =
      instance.mode === 'self-hosted'
        ? await loadApiKey(instance.baseUrl)
        : await loadCloudSessionToken(instance.baseUrl);
    const deviceToken = await loadDeviceToken(instance.baseUrl);
    const gatewayAuth: GatewayAuthOptions = {
      ...authFromInstance(instance.mode, apiKey),
      deviceToken,
    };
    const client = new CarinaClient({
      baseUrl: instance.baseUrl,
      credentials: gatewayAuth.credentials,
      apiKey: gatewayAuth.apiKey ?? undefined,
    });
    return { apiKey, deviceToken, gatewayAuth, client };
  }, []);

  const refresh = useCallback(async () => {
    let instance = await loadInstanceConfig();
    if (!instance.sessionId) {
      instance = await ensureSessionId();
    }
    const { apiKey, gatewayAuth, client } = await buildClientState(instance);

    let user: HostedUser | null = null;
    let cloudSessionExpired = false;
    if (instance.mode === 'cloud') {
      try {
        const ctx = await client.hostedContext();
        user = ctx.user;
      } catch (err) {
        user = null;
        const msg = err instanceof Error ? err.message : String(err);
        cloudSessionExpired = isApiAuthError(msg);
      }
    }

    setState({ ready: true, instance, user, client, apiKey, gatewayAuth, cloudSessionExpired });
  }, [buildClientState]);

  const setInstance = useCallback(
    (instance: InstanceConfig) => {
      void buildClientState(instance).then(({ apiKey, gatewayAuth, client }) => {
        setState((prev) => {
          const sameInstance =
            prev.instance?.sessionId === instance.sessionId &&
            prev.instance?.baseUrl === instance.baseUrl &&
            prev.instance?.mode === instance.mode;
          const sameAuth =
            prev.apiKey === apiKey &&
            prev.gatewayAuth?.apiKey === gatewayAuth.apiKey &&
            prev.gatewayAuth?.deviceToken === gatewayAuth.deviceToken &&
            prev.gatewayAuth?.credentials === gatewayAuth.credentials;
          if (sameInstance && sameAuth && prev.client) {
            return prev.instance === instance ? prev : { ...prev, instance };
          }
          return {
            ...prev,
            instance,
            client,
            apiKey,
            gatewayAuth,
          };
        });
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
      await clearCloudSessionToken(state.instance.baseUrl);
    }
    await refresh();
    setState((prev) => ({
      ...prev,
      cloudSessionExpired: false,
    }));
  }, [state.client, state.instance, refresh]);

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
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

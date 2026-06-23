export interface GatewayAuthOptions {
  credentials?: RequestCredentials;
  apiKey?: string | null;
  deviceToken?: string | null;
}

export function buildGatewayHeaders(auth?: GatewayAuthOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (auth?.apiKey) {
    headers.Authorization = `Bearer ${auth.apiKey}`;
  }
  if (auth?.deviceToken) {
    headers['X-Device-Token'] = auth.deviceToken;
  }
  return headers;
}

export function mergeGatewayInit(
  auth: GatewayAuthOptions | undefined,
  init?: RequestInit,
): RequestInit {
  return {
    ...init,
    credentials: auth?.credentials ?? init?.credentials ?? 'omit',
    headers: {
      ...buildGatewayHeaders(auth),
      ...(init?.headers as Record<string, string> | undefined),
    },
  };
}

export function authFromInstance(
  mode: 'cloud' | 'self-hosted',
  apiKey: string | null,
): GatewayAuthOptions {
  return {
    credentials: mode === 'cloud' ? 'include' : 'omit',
    apiKey: mode === 'self-hosted' ? apiKey : null,
  };
}

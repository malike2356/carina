import type {
  CarinaConfig,
  CarinaHealth,
  ChatRequest,
  ChatResponse,
  HostedContext,
  MeResponse,
  ProvidersResponse,
  SwitchProviderResponse,
} from './types';

export interface CarinaClientOptions {
  baseUrl: string;
  credentials?: RequestCredentials;
  apiKey?: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function formatApiError(status: number, body: string, statusText: string): string {
  const trimmed = body.trim();
  if (!trimmed) return `Carina API ${status}: ${statusText || 'Request failed'}`;

  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('self.__next_f')) {
    if (status === 404) {
      return 'Carina Cloud login route is missing on the server. Update the app or try again after a Cloud deploy.';
    }
    return `Carina API ${status}: server returned an HTML error page instead of JSON.`;
  }

  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    const msg = parsed.error ?? parsed.message;
    if (msg) return msg;
  } catch {
    // not JSON
  }

  const short = trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed;
  return `Carina API ${status}: ${short}`;
}

export class CarinaClient {
  readonly baseUrl: string;
  private readonly credentials: RequestCredentials;
  private readonly apiKey?: string;

  constructor(options: CarinaClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.credentials = options.credentials ?? 'include';
    this.apiKey = options.apiKey;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: this.credentials,
      headers: {
        ...buildHeaders(this.apiKey),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(formatApiError(response.status, body, response.statusText));
    }

    return response.json() as Promise<T>;
  }

  health(): Promise<CarinaHealth> {
    return this.request<CarinaHealth>('/api/health');
  }

  config(): Promise<CarinaConfig> {
    return this.request<CarinaConfig>('/api/config');
  }

  providers(): Promise<ProvidersResponse> {
    return this.request<ProvidersResponse>('/api/providers');
  }

  chat(body: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  clearSession(sessionId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>('/api/clear', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  hostedContext(): Promise<HostedContext> {
    return this.request<HostedContext>('/api/hosted/context');
  }

  async login(email: string, password: string): Promise<{ ok: boolean; token?: string }> {
    return this.request<{ ok: boolean; token?: string }>('/app/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request<{ ok: boolean }>('/app/auth/logout', { method: 'POST' });
  }

  register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ ok: boolean; redirect?: string; token?: string }> {
    return this.request<{ ok: boolean; redirect?: string; token?: string }>('/app/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        ...(name?.trim() ? { name: name.trim() } : {}),
      }),
    });
  }

  forgotPassword(email: string): Promise<{ ok: boolean; emailDisabled?: boolean }> {
    return this.request<{ ok: boolean; emailDisabled?: boolean }>('/app/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>('/app/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  me(): Promise<MeResponse> {
    return this.request<MeResponse>('/app/auth/me');
  }

  switchProvider(provider: string): Promise<SwitchProviderResponse> {
    return this.request<SwitchProviderResponse>('/api/providers/switch', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
  }
}

import type {
  CarinaConfig,
  CarinaHealth,
  ChatRequest,
  ChatResponse,
  HostedContext,
  ProvidersResponse,
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
      throw new Error(`Carina API ${response.status}: ${body || response.statusText}`);
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

  async login(email: string, password: string): Promise<void> {
    await this.request<{ ok: boolean }>('/app/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request<{ ok: boolean }>('/app/auth/logout', { method: 'POST' });
  }
}

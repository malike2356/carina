const TOKEN_KEY = 'carina_cloud_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    const res = await fetch(path, { ...init, headers });
    const data = await res.json() as T & { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? `Request failed (${res.status})`);
    }
    return data;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Network error');
  }
}

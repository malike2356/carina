export interface PushRegisterBody {
  token: string;
  platform: 'ios' | 'android';
  taskAlerts: boolean;
  scoutAlerts: boolean;
}

export interface PushStatusResponse {
  registered: boolean;
  tokenCount: number;
  taskAlerts: boolean;
  scoutAlerts: boolean;
}

export async function registerPushToken(
  baseUrl: string,
  body: PushRegisterBody,
): Promise<void> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/app/auth/push/register`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push register ${response.status}: ${text || response.statusText}`);
  }
}

export async function unregisterPushToken(baseUrl: string, token: string): Promise<void> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/app/auth/push/unregister`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push unregister ${response.status}: ${text || response.statusText}`);
  }
}

export async function fetchPushStatus(baseUrl: string): Promise<PushStatusResponse> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/app/auth/push/status`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push status ${response.status}: ${text || response.statusText}`);
  }
  return response.json() as Promise<PushStatusResponse>;
}

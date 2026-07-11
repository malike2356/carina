import { DEFAULT_CLOUD_URL } from '@/config/defaults';

export async function claimMobileLogin(
  token: string,
  baseUrl = DEFAULT_CLOUD_URL,
): Promise<{ token: string }> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/app/auth/mobile-login/claim`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    token?: string;
    error?: string;
  };
  if (!response.ok || !body.token) {
    throw new Error(body.error || `Login claim failed (${response.status})`);
  }
  return { token: body.token };
}

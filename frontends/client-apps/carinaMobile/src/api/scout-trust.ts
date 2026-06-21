import type { PublicTrustPayload } from './types';

export async function fetchPublicTrust(trustUrl: string): Promise<PublicTrustPayload> {
  const response = await fetch(trustUrl, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Scout trust ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<PublicTrustPayload>;
}

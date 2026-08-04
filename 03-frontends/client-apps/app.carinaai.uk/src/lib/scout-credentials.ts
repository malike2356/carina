export type ScoutCredentialVerification =
  | { ok: true }
  | { ok: false; error: string };

export async function verifyScoutCredentials(
  scoutUrl: string,
  apiKey: string,
): Promise<ScoutCredentialVerification> {
  const baseUrl = scoutUrl.replace(/\/$/, '');
  try {
    const response = await fetch(`${baseUrl}/api/events?limit=1`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Scout-Key': apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      return { ok: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'Scout rejected the API key' };
    }

    return { ok: false, error: `Scout returned HTTP ${response.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scout credential check failed';
    return { ok: false, error: message };
  }
}

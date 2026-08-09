/**
 * Pure watch renewal helpers (unit-tested without Google).
 */

export function shouldRenewWatch(opts: {
  channelExpiresAt: string | null | undefined;
  now?: Date;
  overlapHours?: number;
}): boolean {
  const expiresRaw = opts.channelExpiresAt;
  if (!expiresRaw) return true;
  const now = opts.now ?? new Date();
  const overlapMs = (opts.overlapHours ?? 2) * 60 * 60 * 1000;
  try {
    const expires = new Date(expiresRaw);
    return expires.getTime() - now.getTime() <= overlapMs;
  } catch {
    return true;
  }
}

export function webhookPublicUrl(explicit?: string): string {
  const base = (
    explicit?.trim() ||
    process.env.DOCUMENT_VAULT_GOOGLE_WEBHOOK_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    ''
  ).replace(/\/$/, '');
  if (!base) return '';
  if (base.includes('/api/vault/google/webhook')) return base;
  return `${base}/api/vault/google/webhook`;
}

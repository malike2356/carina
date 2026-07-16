import { resolvePublicCoreHttpUrl } from '@/lib/core-proxy';

const CACHE_TTL_MS = 30_000;

type PlatformSurface = {
  supportEmail: string;
  supportInboxMonitor: string;
  p0EscalationContact: string;
};

let cached: PlatformSurface | null = null;
let cachedAt = 0;

export async function fetchPlatformSurface(): Promise<PlatformSurface | null> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const base = resolvePublicCoreHttpUrl();
  try {
    const response = await fetch(`${base}/api/public/platform-surface`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as PlatformSurface;
    cached = {
      supportEmail: data.supportEmail?.trim() || '',
      supportInboxMonitor: data.supportInboxMonitor?.trim() || '',
      p0EscalationContact: data.p0EscalationContact?.trim() || '',
    };
    cachedAt = Date.now();
    return cached;
  } catch {
    return null;
  }
}

export function invalidatePlatformSurfaceCache(): void {
  cached = null;
  cachedAt = 0;
}

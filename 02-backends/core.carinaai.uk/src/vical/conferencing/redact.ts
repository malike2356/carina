/**
 * Strip Zoom host start URLs and OAuth secrets from any outbound payload.
 */

const HOST_START_KEYS = new Set([
  'start_url',
  'starturl',
  'hoststarturl',
  'host_start_url',
  'zoom_start_url',
]);

const SECRET_KEYS = /access_token|refresh_token|password|passcode|token|secret|authorization|credential/i;

export function isHostStartUrlKey(key: string): boolean {
  return HOST_START_KEYS.has(key.toLowerCase().replace(/[^a-z0-9_]/g, ''));
}

export function looksLikeZoomStartUrl(value: string): boolean {
  return /zoom\.us\/s\/|zoom\.us\/j\/.*[?&]zak=/i.test(value) || /start_url/i.test(value);
}

export function redactConferencingSecrets<T>(value: T): T {
  return redactInner(value) as T;
}

function redactInner(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (looksLikeZoomStartUrl(value)) return '[REDACTED_HOST_START_URL]';
    return value;
  }
  if (Array.isArray(value)) return value.map(redactInner);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isHostStartUrlKey(key) || SECRET_KEYS.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactInner(child);
      }
    }
    return out;
  }
  return value;
}

/** Safe booking DTO for tools, webhooks, analytics, and browser responses. */
export function toPublicBookingView(booking: Record<string, unknown>): Record<string, unknown> {
  const redacted = redactConferencingSecrets(booking) as Record<string, unknown>;
  delete redacted.hostStartUrl;
  delete redacted.start_url;
  delete redacted.startUrl;
  if (redacted.metadata && typeof redacted.metadata === 'object') {
    const meta = { ...(redacted.metadata as Record<string, unknown>) };
    delete meta.hostStartUrl;
    delete meta.start_url;
    delete meta.zoomStartUrl;
    redacted.metadata = meta;
  }
  return redacted;
}

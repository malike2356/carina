/**
 * Product analytics event schema (additive-only; no PII in properties).
 */

export interface AnalyticsEvent {
  eventId: string;
  workspaceId: string;
  userId: string;
  sessionId?: string;
  eventName: string;
  timestamp: string;
  properties: Record<string, string | number | boolean | null>;
}

export type FeatureAction = 'view' | 'open' | 'use' | 'complete' | 'error' | string;

/** Registered core features for adoption reporting and health audits. */
export const REGISTERED_FEATURES = [
  'outreach',
  'pipeline',
  'qualification',
  'analytics',
  'cohort_retention',
  'approvals',
  'calendar',
  'email',
  'workers',
  'settings',
  'billing',
  'tools',
  'concierge',
] as const;

export type RegisteredFeature = (typeof REGISTERED_FEATURES)[number];

export const CORE_EVENT_NAMES = [
  'feature_use',
  'page_view',
  'api_call',
] as const;

const PII_PROPERTY_KEYS = new Set([
  'email',
  'e_mail',
  'name',
  'full_name',
  'fullname',
  'phone',
  'ip',
  'ip_address',
  'address',
  'password',
  'token',
  'secret',
  'ssn',
  'dob',
  'date_of_birth',
]);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

export function assertNoPiiInProperties(
  properties: Record<string, unknown> | undefined,
): { ok: true; properties: AnalyticsEvent['properties'] } | { ok: false; error: string } {
  const out: AnalyticsEvent['properties'] = {};
  if (!properties) return { ok: true, properties: out };
  for (const [key, value] of Object.entries(properties)) {
    const normalized = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (PII_PROPERTY_KEYS.has(normalized)) {
      return { ok: false, error: `PII property key rejected: ${key}` };
    }
    if (value === null || value === undefined) {
      out[key] = null;
      continue;
    }
    if (typeof value === 'string') {
      if (EMAIL_RE.test(value) || IPV4_RE.test(value)) {
        return { ok: false, error: `PII-looking value rejected for key: ${key}` };
      }
      out[key] = value.slice(0, 500);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    return { ok: false, error: `Unsupported property type for key: ${key}` };
  }
  return { ok: true, properties: out };
}

export function newEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function monthPartitionKey(timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

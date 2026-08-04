/**
 * Outreach booking cutover onto viCal.
 * One engine: viCal owns free/busy, locks, and booking rows.
 * Outreach JSON mirrors records for Kanban, reminders, and Soft Wall email (combined features).
 * Break-glass: VICAL_OUTREACH_BACKEND=legacy restores the pre-cutover JSON-only path.
 */

export type OutreachBookingBackend = 'vical' | 'legacy';

export function getOutreachBookingBackend(): OutreachBookingBackend {
  const raw = String(process.env.VICAL_OUTREACH_BACKEND ?? 'vical').trim().toLowerCase();
  return raw === 'legacy' ? 'legacy' : 'vical';
}

export function isVicalOutreachBackend(): boolean {
  return getOutreachBookingBackend() === 'vical';
}

export const DEFAULT_VICAL_HOST_USER_ID = 'outreach-host';

export function resolveVicalHostUserId(explicit?: string | null): string {
  const value = (explicit ?? process.env.VICAL_OUTREACH_HOST_USER_ID ?? DEFAULT_VICAL_HOST_USER_ID).trim();
  return value || DEFAULT_VICAL_HOST_USER_ID;
}

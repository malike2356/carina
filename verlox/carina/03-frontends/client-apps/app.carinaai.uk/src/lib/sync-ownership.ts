/**
 * Shared Aiva / Google / local ownership contract for Email, Calendar,
 * Tasks, Documents, and Inbox.
 *
 * Calendar origin is derived from `calendar_events.source` (no extra DB
 * columns required). Mapping:
 * - `aiva` -> aiva (Aiva UI create, or Google re-import with aivaManaged)
 * - `google` -> google (Google Calendar import)
 * - `caldav` -> google (treated as external provider import)
 * - `local` -> local (legacy rows); prefer writing `aiva` for new Aiva creates
 * - `note_reminder` -> local
 *
 * Optional future columns (`origin`, `aiva_managed`, `last_synced_at`) can
 * replace derivation without changing UI helpers.
 */

export type SyncOrigin = 'aiva' | 'google' | 'local';
export type SyncDirection = 'pull' | 'push' | 'both' | 'none';
export type OriginFilter = 'all' | 'aiva' | 'google' | 'local';

export type SyncOwnershipFields = {
  origin: SyncOrigin;
  syncDirection: SyncDirection;
  externalId: string | null;
  aivaManaged: boolean;
  lastSyncedAt: string | null;
};

export const SYNC_OWNERSHIP_HELPER_TEXT =
  'Google sync keeps Aiva-managed items separate from your existing Google items. Aiva will not overwrite Google-native items without approval.';

export const CALENDAR_ORIGIN_HELPER_TEXT =
  'Google events are imported. Aiva events are ones Aiva or you created in Aiva. Charts and analytics are out of scope.';

export const EMAIL_ORIGIN_HELPER_TEXT =
  'Aiva mail is what Aiva drafted or sent. Google mail is imported from Gmail and is not rewritten without approval.';

export const TASKS_ORIGIN_HELPER_TEXT =
  'Workspace schedules keep the workspace tidy (calendar sync, memory tidy). They are not the same as an Aiva\'s Automations tab (morning digests and that employee\'s own routines).';

export const DOCUMENTS_ORIGIN_HELPER_TEXT =
  'Aiva docs are Ops pack files Aiva manages. Google docs are imported from Drive and stay read-mostly unless you Record or approve edits.';

export const INBOX_ORIGIN_HELPER_TEXT =
  'Aiva inbox is work Aiva raised. Google inbox is mail or Drive drops imported for you to review.';

export const ORIGIN_FILTER_OPTIONS: Array<{ id: OriginFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'aiva', label: 'Aiva' },
  { id: 'google', label: 'Google' },
  { id: 'local', label: 'Local only' },
];

export const ORIGIN_BADGE_LABELS: Record<SyncOrigin, string> = {
  aiva: 'Aiva',
  google: 'Google',
  local: 'Local',
};

/** OAuth connection that powers each surface (one Google account per workspace preferred). */
export const SURFACE_GOOGLE_CONNECTION_NOTES = {
  calendar:
    'Settings → Calendar Google connect (calendar.readonly pull). Worker google-driver tools may push to primary.',
  email:
    'AI Employee Gmail OAuth via Email Handler connect (core google-workspace-oauth Gmail scopes).',
  documents:
    'Workspace Ops Drive connect on the worker (Drive API; Ops folder pack under aiva/workspace-ops).',
  tasks:
    'Google Tasks API not wired yet; reconnect will need Tasks scope when enabled.',
  inbox:
    'Combines Email Handler approvals (Aiva) with Drive 07-Inbox-for-Aiva drops (Google until claimed).',
} as const;

export function matchesOriginFilter(
  item: { origin: SyncOrigin },
  filter: OriginFilter,
): boolean {
  if (filter === 'all') return true;
  return item.origin === filter;
}

/**
 * Classify calendar rows from `source` (+ optional aivaManaged).
 * Prefer `source=aiva` for new Aiva creates so re-reads stay Aiva without DB flags.
 */
export function classifyFromCalendarSource(
  source: string | null | undefined,
  options?: { aivaManaged?: boolean | null },
): SyncOrigin {
  const normalized = String(source ?? '').trim().toLowerCase();
  if (options?.aivaManaged === true) return 'aiva';
  if (normalized === 'aiva') return 'aiva';
  if (normalized === 'google' || normalized === 'caldav') return 'google';
  if (normalized === 'note_reminder') return 'local';
  if (normalized === 'local') return 'local';
  return 'local';
}

export function calendarOwnershipFromSource(
  source: string | null | undefined,
  options?: {
    aivaManaged?: boolean | null;
    externalUid?: string | null;
    lastSyncedAt?: string | null;
  },
): SyncOwnershipFields {
  const origin = classifyFromCalendarSource(source, options);
  const aivaManaged = origin === 'aiva' || options?.aivaManaged === true;
  let syncDirection: SyncDirection = 'none';
  if (origin === 'google') syncDirection = 'pull';
  else if (origin === 'aiva' && options?.externalUid) syncDirection = 'both';
  else if (origin === 'aiva') syncDirection = 'push';

  return {
    origin,
    syncDirection,
    externalId: options?.externalUid ?? null,
    aivaManaged,
    lastSyncedAt: options?.lastSyncedAt ?? null,
  };
}

/** Email: explicit source wins; else Gmail import has externalId; Aiva drafts/sends; else local. */
export function classifyEmailOrigin(row: {
  externalId?: string | null;
  status?: string | null;
  aiDraftReply?: string | null;
  source?: string | null;
}): SyncOrigin {
  const source = String(row.source ?? '').trim().toLowerCase();
  if (source === 'aiva' || source.startsWith('aiva-')) return 'aiva';
  if (source === 'google' || source === 'local') return source;
  const status = String(row.status ?? '').toLowerCase();
  if (status === 'draft_reply' || status === 'sent') return 'aiva';
  const externalId = row.externalId?.trim();
  if (externalId) return 'google';
  if (row.aiDraftReply?.trim()) return 'aiva';
  return 'local';
}

export function emailOwnershipFromRow(row: {
  externalId?: string | null;
  status?: string | null;
  aiDraftReply?: string | null;
  source?: string | null;
  lastSyncedAt?: string | null;
}): SyncOwnershipFields {
  const origin = classifyEmailOrigin(row);
  return {
    origin,
    syncDirection: origin === 'google' ? 'pull' : origin === 'aiva' ? 'push' : 'none',
    externalId: row.externalId?.trim() || null,
    aivaManaged: origin === 'aiva',
    lastSyncedAt: row.lastSyncedAt ?? null,
  };
}

/**
 * Tasks: local automations and built-in Aiva tasks.
 * Google Tasks list import is deferred until Tasks API is enabled.
 */
export function classifyTaskOrigin(row: {
  builtIn?: boolean | null;
  origin?: SyncOrigin | null;
  externalId?: string | null;
}): SyncOrigin {
  if (row.origin === 'aiva' || row.origin === 'google' || row.origin === 'local') {
    return row.origin;
  }
  if (row.externalId?.trim()) return 'google';
  if (row.builtIn) return 'aiva';
  return 'local';
}

export function taskOwnershipFromRow(row: {
  builtIn?: boolean | null;
  origin?: SyncOrigin | null;
  externalId?: string | null;
  lastSyncedAt?: string | null;
}): SyncOwnershipFields {
  const origin = classifyTaskOrigin(row);
  return {
    origin,
    syncDirection: origin === 'google' ? 'pull' : origin === 'aiva' ? 'both' : 'none',
    externalId: row.externalId?.trim() || null,
    aivaManaged: origin === 'aiva',
    lastSyncedAt: row.lastSyncedAt ?? null,
  };
}

/**
 * Documents / Workspace Ops: mapped Ops files are Aiva; inbox drops are Google
 * until claimed; workspace-only docs without Drive are local.
 */
export function classifyDocumentOrigin(row: {
  category?: string | null;
  driveWebViewLink?: string | null;
  syncStatus?: string | null;
  claimedByAiva?: boolean | null;
  origin?: SyncOrigin | null;
}): SyncOrigin {
  if (row.origin === 'aiva' || row.origin === 'google' || row.origin === 'local') {
    return row.origin;
  }
  const category = String(row.category ?? '').toLowerCase();
  // Inbox-for-Aiva drops stay google for provenance even after claim.
  if (category === 'inbox') return 'google';
  if (row.driveWebViewLink || row.syncStatus) return 'aiva';
  return 'local';
}

export function documentOwnershipFromRow(row: {
  category?: string | null;
  driveWebViewLink?: string | null;
  syncStatus?: string | null;
  claimedByAiva?: boolean | null;
  origin?: SyncOrigin | null;
  externalId?: string | null;
  lastSyncedAt?: string | null;
}): SyncOwnershipFields {
  const origin = classifyDocumentOrigin(row);
  const claimed = Boolean(row.claimedByAiva);
  return {
    origin,
    syncDirection: origin === 'local' ? 'none' : 'both',
    externalId: row.externalId ?? null,
    aivaManaged: origin === 'aiva' || claimed,
    lastSyncedAt: row.lastSyncedAt ?? null,
  };
}

/** Inbox feed items: approvals are Aiva; Drive/Gmail drops are Google until claimed. */
export function classifyInboxOrigin(row: {
  kind?: string | null;
  origin?: SyncOrigin | null;
  claimedByAiva?: boolean | null;
}): SyncOrigin {
  if (row.origin === 'aiva' || row.origin === 'google' || row.origin === 'local') {
    return row.origin;
  }
  const kind = String(row.kind ?? '').toLowerCase();
  if (kind === 'approval' || kind === 'reminder' || kind === 'automation') return 'aiva';
  if (kind === 'drive_drop' || kind === 'gmail_starred') return 'google';
  return 'local';
}

export function claimInboxItemKeepsProvenance(origin: SyncOrigin): {
  origin: SyncOrigin;
  aivaManaged: boolean;
} {
  return {
    origin,
    aivaManaged: true,
  };
}

/** Sync-indexed ops categories (Drive system of record). */
export const OPS_CATEGORIES = [
  'policies',
  'minutes',
  'attendance',
  'next-meeting',
  'funder-month',
  'templates',
  'inbox',
] as const;

export type OpsCategory = (typeof OPS_CATEGORIES)[number];

/** Drive folder pack profiles (labels/templates only; category keys stay stable). */
export const OPS_PACK_PROFILES = ['default', 'community-sessions'] as const;

export type OpsPackProfile = (typeof OPS_PACK_PROFILES)[number];

/** Categories pulled into Aiva knowledge on sync. */
export const INDEXED_OPS_CATEGORIES: readonly OpsCategory[] = [
  'policies',
  'minutes',
  'attendance',
  'next-meeting',
  'funder-month',
  'inbox',
] as const;

export type SyncStatus = 'synced' | 'pending' | 'drive_only' | 'conflict' | 'error' | 'deleted';

export type SyncDirection = 'pull' | 'push' | 'both';

export interface WorkspaceOpsBinding {
  id: string;
  workspaceId: string;
  workerId: string;
  orgName: string;
  rootFolderId: string;
  rootFolderName: string;
  syncCursor: string;
  pollMinutes: number;
  lastSyncAt: string | null;
  lastSyncDirection: string;
  lastError: string | null;
  lastConflictAt: string | null;
  lastConflictSummary: string | null;
  enabled: boolean;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceOpsFolder {
  id: string;
  bindingId: string;
  category: OpsCategory;
  folderId: string;
  folderName: string;
}

export interface WorkspaceOpsMapping {
  id: string;
  bindingId: string;
  workspaceId: string;
  workerId: string;
  category: OpsCategory;
  aivaDocumentId: string | null;
  driveFileId: string;
  driveWebViewLink: string;
  title: string;
  contentHash: string;
  indexable: boolean;
  syncStatus: SyncStatus;
  updatedAtAiva: string | null;
  updatedAtDrive: string | null;
  lastDirection: string;
  lastError: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceOpsSyncRun {
  id: string;
  bindingId: string;
  workspaceId: string;
  direction: string;
  status: 'running' | 'success' | 'error';
  pulled: number;
  pushed: number;
  conflicts: number;
  skipped: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** Default Drive folder names (committee / general ops). */
export const FOLDER_LABELS: Record<OpsCategory, string> = {
  policies: '01-Policies',
  minutes: '02-Minutes',
  attendance: '03-Attendance',
  'next-meeting': '04-Next-Meeting',
  'funder-month': '05-Activity-Reports',
  templates: '06-Templates',
  inbox: '07-Inbox-for-Aiva',
};

/** Community sessions / women's wellbeing monthly sessions pack. */
export const COMMUNITY_SESSIONS_FOLDER_LABELS: Record<OpsCategory, string> = {
  policies: '01-Policies-and-Safeguarding',
  minutes: '02-Session-Notes',
  attendance: '03-Attendance',
  'next-meeting': '04-Session-Planner',
  'funder-month': '05-Funder-Reports',
  templates: '06-Posters-and-Templates',
  inbox: '07-Inbox-for-Aiva',
};

const PACK_FOLDER_LABELS: Record<OpsPackProfile, Record<OpsCategory, string>> = {
  default: FOLDER_LABELS,
  'community-sessions': COMMUNITY_SESSIONS_FOLDER_LABELS,
};

export function isOpsCategory(value: string): value is OpsCategory {
  return (OPS_CATEGORIES as readonly string[]).includes(value);
}

export function isOpsPackProfile(value: string): value is OpsPackProfile {
  return (OPS_PACK_PROFILES as readonly string[]).includes(value);
}

export function resolveOpsPackProfile(value: unknown): OpsPackProfile {
  if (typeof value === 'string' && isOpsPackProfile(value)) return value;
  return 'default';
}

export function folderLabelsForPack(profile: OpsPackProfile = 'default'): Record<OpsCategory, string> {
  return PACK_FOLDER_LABELS[profile] ?? FOLDER_LABELS;
}

export function packProfileFromBindingMeta(meta: Record<string, unknown> | null | undefined): OpsPackProfile {
  return resolveOpsPackProfile(meta?.packProfile);
}

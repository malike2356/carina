import { pool } from '../../memory/db.js';
import {
  FOLDER_LABELS,
  type OpsCategory,
  type SyncStatus,
  type WorkspaceOpsBinding,
  type WorkspaceOpsFolder,
  type WorkspaceOpsMapping,
  type WorkspaceOpsSyncRun,
} from './types.js';

function iso(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

function mapBinding(row: Record<string, unknown>): WorkspaceOpsBinding {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    orgName: String(row.org_name ?? ''),
    rootFolderId: String(row.root_folder_id ?? ''),
    rootFolderName: String(row.root_folder_name ?? ''),
    syncCursor: String(row.sync_cursor ?? ''),
    pollMinutes: Number(row.poll_minutes ?? 10),
    lastSyncAt: iso(row.last_sync_at),
    lastSyncDirection: String(row.last_sync_direction ?? ''),
    lastError: row.last_error != null ? String(row.last_error) : null,
    lastConflictAt: iso(row.last_conflict_at),
    lastConflictSummary: row.last_conflict_summary != null ? String(row.last_conflict_summary) : null,
    enabled: Boolean(row.enabled ?? true),
    meta: (row.meta_json as Record<string, unknown>) ?? {},
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapFolder(row: Record<string, unknown>): WorkspaceOpsFolder {
  return {
    id: String(row.id),
    bindingId: String(row.binding_id),
    category: String(row.category) as OpsCategory,
    folderId: String(row.folder_id),
    folderName: String(row.folder_name ?? ''),
  };
}

function mapMapping(row: Record<string, unknown>): WorkspaceOpsMapping {
  return {
    id: String(row.id),
    bindingId: String(row.binding_id),
    workspaceId: String(row.workspace_id),
    workerId: String(row.worker_id),
    category: String(row.category ?? 'inbox') as OpsCategory,
    aivaDocumentId: row.aiva_document_id ? String(row.aiva_document_id) : null,
    driveFileId: String(row.drive_file_id),
    driveWebViewLink: String(row.drive_web_view_link ?? ''),
    title: String(row.title ?? ''),
    contentHash: String(row.content_hash ?? ''),
    indexable: Boolean(row.indexable ?? true),
    syncStatus: String(row.sync_status ?? 'synced') as SyncStatus,
    updatedAtAiva: iso(row.updated_at_aiva),
    updatedAtDrive: iso(row.updated_at_drive),
    lastDirection: String(row.last_direction ?? ''),
    lastError: row.last_error != null ? String(row.last_error) : null,
    meta: (row.meta_json as Record<string, unknown>) ?? {},
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapRun(row: Record<string, unknown>): WorkspaceOpsSyncRun {
  return {
    id: String(row.id),
    bindingId: String(row.binding_id),
    workspaceId: String(row.workspace_id),
    direction: String(row.direction ?? 'both'),
    status: String(row.status ?? 'running') as WorkspaceOpsSyncRun['status'],
    pulled: Number(row.pulled ?? 0),
    pushed: Number(row.pushed ?? 0),
    conflicts: Number(row.conflicts ?? 0),
    skipped: Number(row.skipped ?? 0),
    error: row.error != null ? String(row.error) : null,
    startedAt: iso(row.started_at) ?? new Date().toISOString(),
    finishedAt: iso(row.finished_at),
  };
}

export async function getBinding(
  workspaceId: string,
  workerId: string,
): Promise<WorkspaceOpsBinding | null> {
  const result = await pool.query(
    `SELECT * FROM aiva_workspace_ops_bindings
     WHERE workspace_id = $1 AND worker_id = $2`,
    [workspaceId, workerId],
  );
  if (!result.rows[0]) return null;
  return mapBinding(result.rows[0] as Record<string, unknown>);
}

export async function getBindingById(bindingId: string): Promise<WorkspaceOpsBinding | null> {
  const result = await pool.query(`SELECT * FROM aiva_workspace_ops_bindings WHERE id = $1`, [
    bindingId,
  ]);
  if (!result.rows[0]) return null;
  return mapBinding(result.rows[0] as Record<string, unknown>);
}

export async function listEnabledBindings(): Promise<WorkspaceOpsBinding[]> {
  const result = await pool.query(
    `SELECT * FROM aiva_workspace_ops_bindings
     WHERE enabled = true AND root_folder_id <> ''`,
  );
  return result.rows.map((row) => mapBinding(row as Record<string, unknown>));
}

export async function upsertBinding(input: {
  workspaceId: string;
  workerId: string;
  orgName: string;
  rootFolderId?: string;
  rootFolderName?: string;
  pollMinutes?: number;
  meta?: Record<string, unknown>;
}): Promise<WorkspaceOpsBinding> {
  const result = await pool.query(
    `INSERT INTO aiva_workspace_ops_bindings
       (workspace_id, worker_id, org_name, root_folder_id, root_folder_name, poll_minutes, meta_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (workspace_id, worker_id) DO UPDATE SET
       org_name = EXCLUDED.org_name,
       root_folder_id = CASE
         WHEN EXCLUDED.root_folder_id <> '' THEN EXCLUDED.root_folder_id
         ELSE aiva_workspace_ops_bindings.root_folder_id
       END,
       root_folder_name = CASE
         WHEN EXCLUDED.root_folder_name <> '' THEN EXCLUDED.root_folder_name
         ELSE aiva_workspace_ops_bindings.root_folder_name
       END,
       poll_minutes = COALESCE(EXCLUDED.poll_minutes, aiva_workspace_ops_bindings.poll_minutes),
       meta_json = aiva_workspace_ops_bindings.meta_json || EXCLUDED.meta_json,
       updated_at = NOW()
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      input.orgName,
      input.rootFolderId ?? '',
      input.rootFolderName ?? '',
      input.pollMinutes ?? 10,
      JSON.stringify(input.meta ?? {}),
    ],
  );
  return mapBinding(result.rows[0] as Record<string, unknown>);
}

export async function updateBindingSyncState(
  bindingId: string,
  patch: {
    syncCursor?: string;
    lastSyncAt?: Date;
    lastSyncDirection?: string;
    lastError?: string | null;
    lastConflictAt?: Date | null;
    lastConflictSummary?: string | null;
  },
): Promise<void> {
  await pool.query(
    `UPDATE aiva_workspace_ops_bindings SET
       sync_cursor = COALESCE($2, sync_cursor),
       last_sync_at = COALESCE($3, last_sync_at),
       last_sync_direction = COALESCE($4, last_sync_direction),
       last_error = $5,
       last_conflict_at = COALESCE($6, last_conflict_at),
       last_conflict_summary = COALESCE($7, last_conflict_summary),
       updated_at = NOW()
     WHERE id = $1`,
    [
      bindingId,
      patch.syncCursor ?? null,
      patch.lastSyncAt?.toISOString() ?? null,
      patch.lastSyncDirection ?? null,
      patch.lastError === undefined ? null : patch.lastError,
      patch.lastConflictAt === undefined ? null : patch.lastConflictAt?.toISOString() ?? null,
      patch.lastConflictSummary ?? null,
    ],
  );
}

export async function upsertFolder(input: {
  bindingId: string;
  category: OpsCategory;
  folderId: string;
  folderName?: string;
}): Promise<WorkspaceOpsFolder> {
  const result = await pool.query(
    `INSERT INTO aiva_workspace_ops_folders (binding_id, category, folder_id, folder_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (binding_id, category) DO UPDATE SET
       folder_id = EXCLUDED.folder_id,
       folder_name = EXCLUDED.folder_name
     RETURNING *`,
    [
      input.bindingId,
      input.category,
      input.folderId,
      input.folderName ?? FOLDER_LABELS[input.category],
    ],
  );
  return mapFolder(result.rows[0] as Record<string, unknown>);
}

export async function listFolders(bindingId: string): Promise<WorkspaceOpsFolder[]> {
  const result = await pool.query(
    `SELECT * FROM aiva_workspace_ops_folders WHERE binding_id = $1 ORDER BY category`,
    [bindingId],
  );
  return result.rows.map((row) => mapFolder(row as Record<string, unknown>));
}

export async function listMappings(bindingId: string): Promise<WorkspaceOpsMapping[]> {
  const result = await pool.query(
    `SELECT * FROM aiva_workspace_ops_mappings
     WHERE binding_id = $1 AND sync_status <> 'deleted'
     ORDER BY category, title`,
    [bindingId],
  );
  return result.rows.map((row) => mapMapping(row as Record<string, unknown>));
}

export async function getMappingByDriveFile(
  bindingId: string,
  driveFileId: string,
): Promise<WorkspaceOpsMapping | null> {
  const result = await pool.query(
    `SELECT * FROM aiva_workspace_ops_mappings
     WHERE binding_id = $1 AND drive_file_id = $2`,
    [bindingId, driveFileId],
  );
  if (!result.rows[0]) return null;
  return mapMapping(result.rows[0] as Record<string, unknown>);
}

export async function getMappingByDocument(
  aivaDocumentId: string,
): Promise<WorkspaceOpsMapping | null> {
  const result = await pool.query(
    `SELECT * FROM aiva_workspace_ops_mappings
     WHERE aiva_document_id = $1 AND sync_status <> 'deleted'
     ORDER BY updated_at DESC LIMIT 1`,
    [aivaDocumentId],
  );
  if (!result.rows[0]) return null;
  return mapMapping(result.rows[0] as Record<string, unknown>);
}

export async function upsertMapping(input: {
  bindingId: string;
  workspaceId: string;
  workerId: string;
  category: OpsCategory;
  aivaDocumentId?: string | null;
  driveFileId: string;
  driveWebViewLink?: string;
  title: string;
  contentHash: string;
  indexable?: boolean;
  syncStatus?: SyncStatus;
  updatedAtAiva?: Date | null;
  updatedAtDrive?: Date | null;
  lastDirection?: string;
  lastError?: string | null;
  meta?: Record<string, unknown>;
}): Promise<WorkspaceOpsMapping> {
  const result = await pool.query(
    `INSERT INTO aiva_workspace_ops_mappings
       (binding_id, workspace_id, worker_id, category, aiva_document_id, drive_file_id,
        drive_web_view_link, title, content_hash, indexable, sync_status,
        updated_at_aiva, updated_at_drive, last_direction, last_error, meta_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
     ON CONFLICT (binding_id, drive_file_id) DO UPDATE SET
       category = EXCLUDED.category,
       aiva_document_id = COALESCE(EXCLUDED.aiva_document_id, aiva_workspace_ops_mappings.aiva_document_id),
       drive_web_view_link = CASE
         WHEN EXCLUDED.drive_web_view_link <> '' THEN EXCLUDED.drive_web_view_link
         ELSE aiva_workspace_ops_mappings.drive_web_view_link
       END,
       title = EXCLUDED.title,
       content_hash = EXCLUDED.content_hash,
       indexable = EXCLUDED.indexable,
       sync_status = EXCLUDED.sync_status,
       updated_at_aiva = COALESCE(EXCLUDED.updated_at_aiva, aiva_workspace_ops_mappings.updated_at_aiva),
       updated_at_drive = COALESCE(EXCLUDED.updated_at_drive, aiva_workspace_ops_mappings.updated_at_drive),
       last_direction = EXCLUDED.last_direction,
       last_error = EXCLUDED.last_error,
       meta_json = aiva_workspace_ops_mappings.meta_json || EXCLUDED.meta_json,
       updated_at = NOW()
     RETURNING *`,
    [
      input.bindingId,
      input.workspaceId,
      input.workerId,
      input.category,
      input.aivaDocumentId ?? null,
      input.driveFileId,
      input.driveWebViewLink ?? '',
      input.title,
      input.contentHash,
      input.indexable ?? true,
      input.syncStatus ?? 'synced',
      input.updatedAtAiva?.toISOString() ?? null,
      input.updatedAtDrive?.toISOString() ?? null,
      input.lastDirection ?? '',
      input.lastError ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
  return mapMapping(result.rows[0] as Record<string, unknown>);
}

export async function markMappingDeleted(mappingId: string): Promise<void> {
  await pool.query(
    `UPDATE aiva_workspace_ops_mappings
     SET sync_status = 'deleted', updated_at = NOW()
     WHERE id = $1`,
    [mappingId],
  );
}

export async function startSyncRun(input: {
  bindingId: string;
  workspaceId: string;
  direction: string;
}): Promise<WorkspaceOpsSyncRun> {
  const result = await pool.query(
    `INSERT INTO aiva_workspace_ops_sync_runs (binding_id, workspace_id, direction)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.bindingId, input.workspaceId, input.direction],
  );
  return mapRun(result.rows[0] as Record<string, unknown>);
}

export async function finishSyncRun(
  runId: string,
  patch: {
    status: 'success' | 'error';
    pulled?: number;
    pushed?: number;
    conflicts?: number;
    skipped?: number;
    error?: string | null;
  },
): Promise<void> {
  await pool.query(
    `UPDATE aiva_workspace_ops_sync_runs SET
       status = $2,
       pulled = COALESCE($3, pulled),
       pushed = COALESCE($4, pushed),
       conflicts = COALESCE($5, conflicts),
       skipped = COALESCE($6, skipped),
       error = $7,
       finished_at = NOW()
     WHERE id = $1`,
    [
      runId,
      patch.status,
      patch.pulled ?? null,
      patch.pushed ?? null,
      patch.conflicts ?? null,
      patch.skipped ?? null,
      patch.error ?? null,
    ],
  );
}

export async function latestSyncRun(bindingId: string): Promise<WorkspaceOpsSyncRun | null> {
  const result = await pool.query(
    `SELECT * FROM aiva_workspace_ops_sync_runs
     WHERE binding_id = $1
     ORDER BY started_at DESC LIMIT 1`,
    [bindingId],
  );
  if (!result.rows[0]) return null;
  return mapRun(result.rows[0] as Record<string, unknown>);
}

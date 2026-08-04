import { pool } from '../memory/db.js';

export type WorkspaceRagStatus = {
  documentCount: number;
  domains: string[];
  totalTokens: number;
  lastUpdated: string | null;
};

export async function getWorkspaceRagStatus(workspaceId?: string | null): Promise<WorkspaceRagStatus> {
  try {
    const params: unknown[] = [];
    let where = '';
    if (workspaceId) {
      where = 'WHERE workspace_id = $1::uuid';
      params.push(workspaceId);
    }

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT source)::int AS doc_count,
              COUNT(*)::int AS chunk_count,
              COALESCE(SUM(LENGTH(content)), 0)::int AS char_count,
              MAX(created_at) AS last_updated
       FROM rag_chunks ${where}`,
      params,
    );
    const row = countResult.rows[0] as {
      doc_count?: number;
      chunk_count?: number;
      char_count?: number;
      last_updated?: Date | string | null;
    };

    const packResult = await pool.query(
      `SELECT DISTINCT pack FROM rag_chunks ${where} ORDER BY pack`,
      params,
    );
    const domains = packResult.rows
      .map((r) => String((r as { pack?: string }).pack ?? '').trim())
      .filter(Boolean);

    const chunkCount = Number(row?.chunk_count ?? 0);
    const charCount = Number(row?.char_count ?? 0);

    return {
      documentCount: Number(row?.doc_count ?? 0),
      domains,
      totalTokens: Math.ceil(charCount / 4),
      lastUpdated: row?.last_updated
        ? new Date(row.last_updated).toISOString()
        : null,
    };
  } catch {
    return {
      documentCount: 0,
      domains: [],
      totalTokens: 0,
      lastUpdated: null,
    };
  }
}

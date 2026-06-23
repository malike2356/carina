import { pool } from '../db.js';

let evidenceTableExists: boolean | null = null;

export async function hasComplianceEvidenceTable(): Promise<boolean> {
  if (evidenceTableExists !== null) return evidenceTableExists;

  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'compliance_evidence'
     ) AS exists`,
  );
  evidenceTableExists = result.rows[0]?.exists ?? false;
  return evidenceTableExists;
}

export function resetComplianceTableCacheForTests(): void {
  evidenceTableExists = null;
}

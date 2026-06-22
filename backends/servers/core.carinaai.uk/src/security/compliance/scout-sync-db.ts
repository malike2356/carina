import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { scoutControlsForCarinaId, type ScoutEvidenceSyncPayload, type ScoutEvidenceSyncResult } from './scout-sync.js';

const VALID_EVIDENCE_TYPES = new Set([
  'config',
  'log',
  'policy',
  'procedure',
  'screenshot',
  'attestation',
]);

function normalizeEvidenceType(raw: string): string {
  const value = raw.trim().toLowerCase();
  return VALID_EVIDENCE_TYPES.has(value) ? value : 'attestation';
}

function contentHash(controlId: string, item: ScoutEvidenceSyncPayload['controls'][number]['evidence'][number]): string {
  return createHash('sha256')
    .update(JSON.stringify({
      controlId,
      type: item.type,
      description: item.description,
      source: item.source,
      value: item.value,
    }))
    .digest('hex');
}

export function resolveScoutDatabaseUrl(): string | null {
  const url = (
    process.env.SCOUT_COMPLIANCE_DB_URL
    ?? process.env.SCOUT_DATABASE_URL
    ?? ''
  ).trim();
  return url || null;
}

export async function syncCompliancePayloadToScoutDatabase(
  payload: ScoutEvidenceSyncPayload,
): Promise<ScoutEvidenceSyncResult> {
  const connectionString = resolveScoutDatabaseUrl();
  if (!connectionString) {
    throw new Error('SCOUT_DATABASE_URL is not configured for direct compliance sync');
  }

  const pool = new pg.Pool({ connectionString });
  const result: ScoutEvidenceSyncResult = {
    ok: true,
    inserted: 0,
    skipped: 0,
    controlsTouched: [],
    errors: [],
  };
  const touched = new Set<string>();

  try {
    const tableCheck = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.compliance_evidence') AS reg`,
    );
    if (!tableCheck.rows[0]?.reg) {
      throw new Error('compliance_evidence table is not available');
    }

    for (const control of payload.controls ?? []) {
      if (!control.evidence?.length) continue;
      const scoutIds = scoutControlsForCarinaId(control.carinaControlId);
      if (scoutIds.length === 0) {
        result.errors.push(`No Scout control mapping for ${control.carinaControlId}`);
        continue;
      }

      for (const scoutControlId of scoutIds) {
        const exists = await pool.query<{ exists: boolean }>(
          `SELECT EXISTS (SELECT 1 FROM compliance_controls WHERE id = $1) AS exists`,
          [scoutControlId],
        );
        if (!exists.rows[0]?.exists) {
          result.errors.push(`Unknown Scout control ${scoutControlId}`);
          continue;
        }

        for (const item of control.evidence) {
          const hash = contentHash(scoutControlId, item);
          const duplicate = await pool.query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM compliance_evidence
               WHERE control_id = $1 AND content_hash = $2
             ) AS exists`,
            [scoutControlId, hash],
          );
          if (duplicate.rows[0]?.exists) {
            result.skipped += 1;
            touched.add(scoutControlId);
            continue;
          }

          await pool.query(
            `INSERT INTO compliance_evidence (
               id, control_id, evidence_type, source_agent_id, source_tool,
               description, raw_data, content_hash, collected_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
            [
              randomUUID(),
              scoutControlId,
              normalizeEvidenceType(item.type),
              payload.source ?? 'carina-core',
              control.collectorId ?? item.source,
              item.description || control.controlName,
              JSON.stringify({
                carinaControlId: control.carinaControlId,
                carinaStatus: control.status,
                framework: payload.framework,
                generatedAt: payload.generatedAt,
                source: item.source,
                value: item.value,
              }),
              hash,
              new Date(item.collectedAt || Date.now()).toISOString(),
            ],
          );
          result.inserted += 1;
          touched.add(scoutControlId);
        }
      }
    }
  } finally {
    await pool.end();
  }

  result.controlsTouched = [...touched].sort();
  return result;
}

import { createHash, randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { scoutControlsForCarinaId } from './control-map.js';
import { hasComplianceEvidenceTable } from './table-check.js';

export type CarinaEvidenceItemPayload = {
  type: string;
  description: string;
  source: string;
  value: unknown;
  collectedAt: number;
};

export type CarinaControlEvidencePayload = {
  carinaControlId: string;
  controlName: string;
  status: string;
  collectorId?: string;
  evidence: CarinaEvidenceItemPayload[];
};

export type CarinaEvidenceSyncPayload = {
  framework: string;
  generatedAt: string;
  source?: string;
  controls: CarinaControlEvidencePayload[];
};

export type EvidenceIngestResult = {
  inserted: number;
  skipped: number;
  controlsTouched: string[];
  errors: string[];
};

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

function contentHash(controlId: string, item: CarinaEvidenceItemPayload): string {
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

async function controlExists(controlId: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM compliance_controls WHERE id = $1
     ) AS exists`,
    [controlId],
  );
  return Boolean(result.rows[0]?.exists);
}

async function hasDuplicateHash(controlId: string, hash: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM compliance_evidence
       WHERE control_id = $1 AND content_hash = $2
     ) AS exists`,
    [controlId, hash],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function ingestCarinaEvidence(
  payload: CarinaEvidenceSyncPayload,
): Promise<EvidenceIngestResult> {
  const ready = await hasComplianceEvidenceTable();
  if (!ready) {
    throw new Error('compliance_evidence table is not available');
  }

  const result: EvidenceIngestResult = {
    inserted: 0,
    skipped: 0,
    controlsTouched: [],
    errors: [],
  };
  const touched = new Set<string>();

  for (const control of payload.controls ?? []) {
    if (!control.evidence?.length) continue;

    const scoutIds = scoutControlsForCarinaId(control.carinaControlId);
    if (scoutIds.length === 0) {
      result.errors.push(`No Scout control mapping for ${control.carinaControlId}`);
      continue;
    }

    for (const scoutControlId of scoutIds) {
      if (!(await controlExists(scoutControlId))) {
        result.errors.push(`Unknown Scout control ${scoutControlId}`);
        continue;
      }

      for (const item of control.evidence) {
        const hash = contentHash(scoutControlId, item);
        if (await hasDuplicateHash(scoutControlId, hash)) {
          result.skipped += 1;
          touched.add(scoutControlId);
          continue;
        }

        const collectedAt = new Date(item.collectedAt || Date.now()).toISOString();
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
            collectedAt,
          ],
        );
        result.inserted += 1;
        touched.add(scoutControlId);
      }
    }
  }

  result.controlsTouched = [...touched].sort();
  return result;
}

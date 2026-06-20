import { createWriteStream, type WriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Writable } from 'node:stream';
import { ZipArchive } from 'archiver';
import { pool } from '../db.js';
import { getComplianceScore } from './scoring.js';

interface EvidenceRow {
  id: string;
  control_id: string;
  evidence_type: string;
  source_agent_id: string | null;
  source_tool: string | null;
  description: string;
  raw_data: Record<string, unknown>;
  content_hash: string;
  merkle_proof: Record<string, unknown> | null;
  blockchain_tx: string | null;
  collected_at: string;
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function streamComplianceExport(destination: Writable): Promise<void> {
  const score = await getComplianceScore();
  if (!score.configured) {
    throw new Error('Compliance evidence collection not configured');
  }

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const archiveDone = pipeline(archive, destination);

  archive.append(JSON.stringify({
    exportDate: new Date().toISOString(),
    totalControls: score.totalControls,
    coveredControls: score.coveredControls,
    evidenceCount: score.evidenceCount,
    evidenceWindow: score.evidenceWindow,
    organizationName: process.env.SCOUT_ORG_NAME ?? 'Scout Customer',
  }, null, 2), { name: 'executive-summary.json' });

  for (const control of score.controls) {
    const evidenceResult = await pool.query<EvidenceRow>(
      `SELECT id, control_id, evidence_type, source_agent_id, source_tool,
              description, raw_data, content_hash, merkle_proof, blockchain_tx, collected_at
       FROM compliance_evidence
       WHERE control_id = $1
       ORDER BY collected_at DESC`,
      [control.controlId],
    );

    if (evidenceResult.rows.length === 0) continue;

    const controlDir = `controls/${control.controlId}/`;
    evidenceResult.rows.forEach((row, index) => {
      archive.append(JSON.stringify({
        evidenceId: row.id,
        controlId: row.control_id,
        type: row.evidence_type,
        description: row.description,
        source: { agentId: row.source_agent_id, tool: row.source_tool },
        timestamp: row.collected_at,
        contentHash: row.content_hash,
        merkleProof: row.merkle_proof,
        blockchainTx: row.blockchain_tx,
        data: row.raw_data,
      }, null, 2), {
        name: `${controlDir}evidence-${String(index + 1).padStart(3, '0')}.json`,
      });
    });
  }

  const allEvidence = await pool.query<EvidenceRow>(
    `SELECT id, control_id, evidence_type, source_agent_id, source_tool,
            description, content_hash, blockchain_tx, collected_at
     FROM compliance_evidence
     ORDER BY collected_at ASC`,
  );

  let csv = 'id,timestamp,control_id,type,description,source_agent,source_tool,content_hash,blockchain_tx\n';
  for (const row of allEvidence.rows) {
    csv += [
      row.id,
      row.collected_at,
      row.control_id,
      row.evidence_type,
      csvEscape(row.description),
      row.source_agent_id ?? '',
      row.source_tool ?? '',
      row.content_hash,
      row.blockchain_tx ?? '',
    ].join(',') + '\n';
  }
  archive.append(csv, { name: 'audit-trail.csv' });

  await archive.finalize();
  await archiveDone;
}

export async function writeComplianceExportToFile(filePath: string): Promise<void> {
  await streamComplianceExport(createWriteStream(filePath) as WriteStream);
}

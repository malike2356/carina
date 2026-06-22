import type {
  ComplianceEvidence,
  ComplianceFrameworkId,
  ComplianceReport,
} from './types.js';
import { getControls } from './controls.js';

/** Maps Carina compliance control IDs to Scout SOC2 TSC control IDs. */
export const CARINA_TO_SCOUT_CONTROLS: Record<string, string[]> = {
  'soc2-cc6.1': ['CC6.1', 'CC6.2', 'CC6.3'],
  'soc2-cc6.6': ['CC6.4', 'CC6.6'],
  'soc2-cc6.7': ['CC6.5', 'CC6.7'],
  'soc2-cc7.1': ['CC7.5', 'CC8.1'],
  'soc2-cc7.2': ['CC7.1', 'CC7.2', 'CC4.1'],
  'soc2-cc8.1': ['CC6.8', 'CC8.1'],
  'soc2-cc9.1': ['CC5.1', 'CC3.1', 'CC5.2'],
  'iso-a.5.1': ['CC1.1', 'CC2.1', 'CC5.3'],
  'iso-a.9.2': ['CC6.1', 'CC6.3'],
  'iso-a.12.4': ['CC7.1', 'CC4.1'],
  'iso-a.12.6.1': ['CC6.8'],
  'iso-a.14.2': ['CC7.5', 'CC8.1'],
  'iso-a.8.9': ['CC5.2', 'CC3.4'],
  'iso-a.10.1': ['CC6.4'],
  'iso-a.16.1': ['CC7.2'],
  'gdpr-art6': ['CC1.4', 'CC2.3'],
  'gdpr-art17': ['CC6.5'],
  'gdpr-art25': ['CC5.1'],
  'gdpr-art30': ['CC2.3', 'CC3.1'],
  'gdpr-art32': ['CC6.4', 'CC6.6'],
  'gdpr-art33': ['CC7.2', 'CC4.2'],
};

export type ScoutEvidenceSyncPayload = {
  framework: string;
  generatedAt: string;
  source: 'carina-core';
  controls: Array<{
    carinaControlId: string;
    controlName: string;
    status: string;
    collectorId?: string;
    evidence: Array<{
      type: string;
      description: string;
      source: string;
      value: unknown;
      collectedAt: number;
    }>;
  }>;
};

export type ScoutEvidenceSyncResult = {
  ok: boolean;
  inserted: number;
  skipped: number;
  controlsTouched: string[];
  errors: string[];
};

export function scoutControlsForCarinaId(carinaControlId: string): string[] {
  return CARINA_TO_SCOUT_CONTROLS[carinaControlId] ?? [];
}

export function buildScoutEvidencePayload(report: ComplianceReport): ScoutEvidenceSyncPayload {
  const collectorByControl = new Map(
    getControls(report.framework.id as ComplianceFrameworkId).map((row) => [row.id, row.collectorId]),
  );

  const controls = report.evidence
    .filter((row) => row.evidence.length > 0)
    .map((row: ComplianceEvidence) => ({
      carinaControlId: row.controlId,
      controlName: row.controlName,
      status: row.status,
      collectorId: collectorByControl.get(row.controlId),
      evidence: row.evidence.map((item) => ({
        type: item.type,
        description: item.description,
        source: item.source,
        value: item.value,
        collectedAt: item.collectedAt,
      })),
    }));

  return {
    framework: report.framework.id,
    generatedAt: report.generatedAt,
    source: 'carina-core',
    controls,
  };
}

export function resolveScoutConsoleSyncConfig(): { baseUrl: string; apiKey: string } | null {
  const apiKey = (
    process.env.SCOUT_CONSOLE_API_KEY
    ?? process.env.SCOUT_API_KEY
    ?? process.env.LABYRINTH_API_KEY
    ?? ''
  ).trim();

  const baseUrl = (
    process.env.SCOUT_CONSOLE_URL
    ?? process.env.SCOUT_URL
    ?? process.env.LABYRINTH_URL
    ?? 'http://localhost:4444'
  ).replace(/\/+$/, '');

  if (!apiKey && process.env.SCOUT_AUTH_DISABLED !== 'true') return null;
  return { baseUrl, apiKey };
}

export function scoutComplianceSyncEnabled(): boolean {
  return process.env.CARINA_SCOUT_COMPLIANCE_SYNC !== 'false';
}

export async function syncComplianceReportToScout(
  report: ComplianceReport,
): Promise<ScoutEvidenceSyncResult> {
  const payload = buildScoutEvidencePayload(report);
  if (payload.controls.length === 0) {
    return {
      ok: true,
      inserted: 0,
      skipped: 0,
      controlsTouched: [],
      errors: ['No evidence items to sync'],
    };
  }

  const config = resolveScoutConsoleSyncConfig();
  if (config) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.apiKey) headers['X-Scout-Key'] = config.apiKey;

      const response = await fetch(`${config.baseUrl}/api/compliance/evidence/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      const text = await response.text();
      let data: ScoutEvidenceSyncResult & { error?: string; detail?: string };
      try {
        data = JSON.parse(text) as ScoutEvidenceSyncResult & { error?: string; detail?: string };
      } catch {
        throw new Error(`Scout evidence sync failed (${response.status}): ${text.slice(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(data.detail ?? data.error ?? `Scout evidence sync failed (${response.status})`);
      }

      return {
        ok: Boolean(data.ok),
        inserted: data.inserted ?? 0,
        skipped: data.skipped ?? 0,
        controlsTouched: data.controlsTouched ?? [],
        errors: data.errors ?? [],
      };
    } catch (err) {
      const { resolveScoutDatabaseUrl } = await import('./scout-sync-db.js');
      if (!resolveScoutDatabaseUrl()) throw err;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[compliance] Scout HTTP sync failed (${message}); using database fallback`);
    }
  }

  const { syncCompliancePayloadToScoutDatabase } = await import('./scout-sync-db.js');
  return syncCompliancePayloadToScoutDatabase(payload);
}

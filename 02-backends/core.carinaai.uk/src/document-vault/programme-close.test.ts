/**
 * Document Vault programme close tests (prompt 715).
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildConformanceMatrix, runCeOfflineSmoke } from './conformance.js';
import { documentVaultFlags, documentVaultRollbackSafe } from './flags.js';

describe('Document Vault programme close (715)', () => {
  it('CE offline smoke is green', async () => {
    const result = await runCeOfflineSmoke();
    expect(result.ok).toBe(true);
    expect(result.cross_tenant_leak).toBe(false);
    expect(result.backup_verified).toBe(true);
    expect(result.restored).toBe(true);
    expect(result.ssrf_blocked).toBe(true);
    expect(Number(result.search_hits)).toBeGreaterThanOrEqual(1);
  });

  it('conformance matrix is green with stored evidence and honest Google row', async () => {
    const report = await buildConformanceMatrix({ writeEvidence: true });
    expect(report.summary).toMatchObject({ failed: 0, green: true });
    const evidencePath = String(report.evidence_path || '');
    expect(evidencePath).toContain('document-vault-conformance-715.json');
    const payload = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      summary: { green: boolean };
      honesty: string[];
      matrix: Array<{ capability: string; status: string }>;
    };
    expect(payload.summary.green).toBe(true);
    const honesty = (payload.honesty || []).join(' ');
    expect(honesty).toMatch(/BLOCKED_OPTIONAL_CREDENTIALS|credentials/i);
    const google = payload.matrix.find((r) => r.capability === 'live_google_owner_run');
    expect(google?.status).toBe('BLOCKED_OPTIONAL_CREDENTIALS');
  });

  it('cutover defaults enable V1 with bounded rollback (compat on, retire off)', () => {
    delete process.env.DOCUMENT_VAULT_V1_ENABLED;
    delete process.env.DOCUMENT_VAULT_COMPAT_ADAPTERS;
    delete process.env.DOCUMENT_VAULT_DUAL_WRITE;
    delete process.env.DOCUMENT_VAULT_MIGRATE_DRY_RUN;
    delete process.env.DOCUMENT_VAULT_RETIRE_LEGACY_STORES;

    const flags = documentVaultFlags();
    expect(flags.v1Enabled).toBe(true);
    expect(flags.compatAdapters).toBe(true);
    expect(flags.dualWrite).toBe(false);
    expect(flags.migrateDryRun).toBe(false);
    expect(flags.retireLegacyStores).toBe(false);
    expect(documentVaultRollbackSafe(flags)).toBe(true);
  });
});

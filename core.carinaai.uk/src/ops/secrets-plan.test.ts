import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applySecretsPlan,
  buildSecretsPlanFromAudit,
  rollbackSecretsPlan,
} from './secrets-plan.js';
import type { SecretsAuditReport } from './secrets-audit.js';

describe('secrets-plan', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-secrets-'));
    process.env.CARINA_HOME = tmpHome;
    fs.writeFileSync(path.join(tmpHome, '.env'), 'OLD_API_KEY=changeme\nKEEP_KEY=ok\n', { mode: 0o600 });
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('applies and rolls back a plan', () => {
    const report: SecretsAuditReport = {
      generatedAt: new Date().toISOString(),
      findings: [
        {
          id: 'env:OLD_API_KEY',
          severity: 'fail',
          source: 'env-file',
          key: 'OLD_API_KEY',
          detail: 'placeholder',
        },
      ],
      precedenceDrift: [],
      unresolvedRefs: [],
      summary: { ok: 0, warn: 0, fail: 1 },
    };
    const plan = buildSecretsPlanFromAudit(report);
    const applied = applySecretsPlan(plan.id);
    expect(applied.applied.some((a) => a.includes('OLD_API_KEY'))).toBe(true);
    const contentAfterApply = fs.readFileSync(path.join(tmpHome, '.env'), 'utf-8');
    expect(contentAfterApply).not.toContain('OLD_API_KEY');
    rollbackSecretsPlan(plan.id);
    const contentAfterRollback = fs.readFileSync(path.join(tmpHome, '.env'), 'utf-8');
    expect(contentAfterRollback).toContain('OLD_API_KEY=changeme');
  });
});

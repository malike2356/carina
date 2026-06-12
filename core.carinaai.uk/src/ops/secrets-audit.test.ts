import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditSecrets, writeSecretsReviewReport } from './secrets-audit.js';

describe('secrets-audit', () => {
  let tmpHome: string;
  let envPath: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-secrets-'));
    envPath = path.join(tmpHome, '.env');
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('flags empty secret keys in .env', () => {
    fs.writeFileSync(envPath, 'ANTHROPIC_API_KEY=\nWEB_PORT=3000\n');
    const report = auditSecrets({ envPath, includeProcessEnv: false });
    expect(report.findings.some((f) => f.key === 'ANTHROPIC_API_KEY' && f.severity === 'fail')).toBe(true);
  });

  it('detects process.env precedence drift', () => {
    fs.writeFileSync(envPath, 'OPENAI_API_KEY=file-value\n');
    vi.stubEnv('OPENAI_API_KEY', 'runtime-value');
    const report = auditSecrets({ envPath, includeProcessEnv: true });
    expect(report.precedenceDrift.some((d) => d.includes('OPENAI_API_KEY'))).toBe(true);
  });

  it('detects unresolved credential references', () => {
    fs.writeFileSync(envPath, 'WEB_PORT=3000\n');
    const credPath = path.join(tmpHome, 'credentials.json');
    fs.writeFileSync(credPath, '{"openai": {"token": "${MISSING_REF}"}}');
    vi.stubEnv('CARINA_CREDENTIALS_FILE', credPath);
    const report = auditSecrets({ envPath, includeProcessEnv: true });
    expect(report.unresolvedRefs.some((u) => u.includes('MISSING_REF'))).toBe(true);
  });

  it('writes doctor secrets review artifact', () => {
    fs.writeFileSync(envPath, 'ANTHROPIC_API_KEY=\n');
    const report = auditSecrets({ envPath, includeProcessEnv: false });
    vi.stubEnv('CARINA_HOME', tmpHome);
    const outPath = writeSecretsReviewReport(report, tmpHome);
    expect(fs.existsSync(outPath)).toBe(true);
    const payload = JSON.parse(fs.readFileSync(outPath, 'utf-8')) as { nextStep?: string };
    expect(payload.nextStep).toContain('carina secrets review');
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetCredentialPoolManager } from '../../credentials/pool-manager.js';
import {
  auditStaleSecrets,
  buildSecretsStatusReport,
  formatSecretsStatus,
  formatStaleAudit,
  rotateProvider,
  scheduleProvider,
  secretsRotationScheduler,
} from './rotation-scheduler.js';
import {
  computeSchedule,
  parseDuration,
} from './policies.js';
import {
  _resetSecretsRegistryForTests,
  getRegistryEntry,
  upsertRegistryEntry,
} from './registry.js';
import { shouldBlockStaleSecretsAudit } from './index.js';

describe('secrets rotation policies', () => {
  it('parses duration strings', () => {
    expect(parseDuration('90d')).toBe(90 * 86_400_000);
    expect(parseDuration('5m')).toBe(5 * 60_000);
    expect(parseDuration('1h')).toBe(3_600_000);
  });

  it('computes human-readable schedule hints', () => {
    const hint = computeSchedule({
      provider: 'openai',
      secretType: 'api_key',
      maxAgeMs: 30 * 86_400_000,
      rotationWindowMs: 60_000,
      autoRotate: false,
      notifyBeforeMs: 7 * 86_400_000,
    });
    expect(hint).toBe('every 30 days');
  });
});

describe('secrets rotation scheduler', () => {
  let tmpHome: string;
  let tmpCreds: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `carina-secrets-rot-${Date.now()}`);
    tmpCreds = path.join(os.tmpdir(), `carina-secrets-creds-${Date.now()}.json`);
    process.env.CARINA_HOME = tmpHome;
    process.env.CARINA_CREDENTIALS_FILE = tmpCreds;
    resetCredentialPoolManager();
    await _resetSecretsRegistryForTests();
  });

  afterEach(async () => {
    delete process.env.CARINA_CREDENTIALS_FILE;
    resetCredentialPoolManager();
    await _resetSecretsRegistryForTests();
    if (fs.existsSync(tmpCreds)) fs.unlinkSync(tmpCreds);
  });

  it('schedules rotation policy and next run metadata', async () => {
    await scheduleProvider('customprov', {
      maxAgeMs: 14 * 86_400_000,
      autoRotate: true,
    });
    const entry = await getRegistryEntry('customprov');
    expect(entry).toBeNull();
    const audit = await import('./registry.js').then((m) => m.readRotationAudit());
    expect(audit.some((row) => row.action === 'rotation_scheduled' && row.provider === 'customprov')).toBe(true);
    expect(secretsRotationScheduler.computeSchedule({
      provider: 'customprov',
      secretType: 'api_key',
      maxAgeMs: 14 * 86_400_000,
      rotationWindowMs: 60_000,
      autoRotate: true,
      notifyBeforeMs: 86_400_000,
    })).toBe('every 14 days');
  });

  it('supports dry-run rotation without mutating pools', async () => {
    const mgr = (await import('../../credentials/pool-manager.js')).getCredentialPoolManager();
    mgr.addKey('customprov', 'initial-key-value');
    await upsertRegistryEntry({
      provider: 'customprov',
      secretType: 'api_key',
      expiresAt: Date.now() + 86_400_000,
      active: true,
    });
    const result = await rotateProvider('customprov', { dryRun: true });
    expect(result.rotated).toBe(false);
    expect(result.message).toContain('Dry run');
    expect(mgr.describePool('customprov').size).toBe(1);
  });

  it('builds status report for configured providers', async () => {
    const mgr = (await import('../../credentials/pool-manager.js')).getCredentialPoolManager();
    mgr.addKey('customprov', 'status-key-value');
    await upsertRegistryEntry({
      provider: 'customprov',
      secretType: 'api_key',
      expiresAt: Date.now() + 86_400_000,
      active: true,
    });
    const status = await buildSecretsStatusReport();
    expect(status.rows.some((row) => row.provider === 'customprov')).toBe(true);
    expect(formatSecretsStatus(status)).toContain('customprov');
  });

  it('flags stale credentials in audit report', async () => {
    const mgr = (await import('../../credentials/pool-manager.js')).getCredentialPoolManager();
    mgr.addKey('customprov', 'stale-key-value');
    const staleAge = 120 * 86_400_000;
    await upsertRegistryEntry({
      provider: 'customprov',
      secretType: 'api_key',
      expiresAt: Date.now() - 86_400_000,
      active: true,
      lastRotatedAt: Date.now() - staleAge,
      createdAt: Date.now() - staleAge,
    });
    const audit = await auditStaleSecrets();
    expect(audit.summary.fail).toBeGreaterThan(0);
    expect(formatStaleAudit(audit)).toContain('[fail] customprov');
    expect(shouldBlockStaleSecretsAudit(audit)).toBe(true);
  });
});

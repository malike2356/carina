import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyStateRepair,
  scanChannelPlatformMismatches,
  scanContextEngineCompat,
  scanLegacyDevicePairing,
  scanStateRepair,
  scanToolsetsLegacyFormat,
} from './state-repair.js';

describe('state-repair', () => {
  let tmpHome: string;
  let envPath: string;

  afterEach(() => {
    if (tmpHome && fs.existsSync(tmpHome)) {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
    vi.unstubAllEnvs();
  });

  it('detects invalid context budget env values', () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-repair-'));
    envPath = path.join(tmpHome, '.env');
    fs.writeFileSync(envPath, 'CARINA_CONTEXT_CHAR_BUDGET=not-a-number\n');
    const issues = scanContextEngineCompat(envPath);
    expect(issues.some((i) => i.repairId === 'repair-context-budget')).toBe(true);
    expect(issues[0]?.guidance).toContain('positive integer');
  });

  it('repairs invalid context budget env values', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-repair-'));
    envPath = path.join(tmpHome, '.env');
    fs.writeFileSync(envPath, 'CARINA_CONTEXT_CHAR_BUDGET=bad\n');
    const result = await applyStateRepair('repair-context-budget', tmpHome, envPath);
    expect(result.applied).toContain('context budget');
    const content = fs.readFileSync(envPath, 'utf-8');
    expect(content).toContain('CARINA_CONTEXT_CHAR_BUDGET=48000');
  });

  it('detects legacy toolsets format', () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-repair-'));
    fs.writeFileSync(
      path.join(tmpHome, 'toolsets.yaml'),
      'enabled:\n  - web\n  - file\n',
    );
    const issues = scanToolsetsLegacyFormat(tmpHome);
    expect(issues[0]?.repairId).toBe('normalize-toolsets');
  });

  it('prunes unknown channel platform keys', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-repair-'));
    fs.writeFileSync(
      path.join(tmpHome, 'toolsets.yaml'),
      'version: 1\nplatforms:\n  telegram: {}\n  not-a-channel: {}\n',
    );
    const issues = scanChannelPlatformMismatches(tmpHome);
    expect(issues[0]?.detail).toContain('not-a-channel');
    const result = await applyStateRepair('prune-channel-platforms', tmpHome);
    expect(result.applied).toContain('not-a-channel');
    const content = fs.readFileSync(path.join(tmpHome, 'toolsets.yaml'), 'utf-8');
    expect(content).not.toContain('not-a-channel');
  });

  it('migrates legacy pairing.json', async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-repair-'));
    fs.writeFileSync(
      path.join(tmpHome, 'pairing.json'),
      JSON.stringify({
        code: 'ABC123',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );
    expect(scanLegacyDevicePairing(tmpHome).length).toBe(1);
    const result = await applyStateRepair('migrate-legacy-pairing', tmpHome);
    expect(result.applied).toContain('pairing.json');
    expect(fs.existsSync(path.join(tmpHome, 'devices.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpHome, 'pairing.json'))).toBe(false);
  });

  it('scanStateRepair aggregates checks', () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-repair-'));
    envPath = path.join(tmpHome, '.env');
    fs.writeFileSync(envPath, 'GATEWAY_PORT=3001\nWEB_PORT=3000\n');
    const issues = scanStateRepair(tmpHome, envPath);
    expect(issues.some((i) => i.id.startsWith('env-alias-'))).toBe(true);
  });
});

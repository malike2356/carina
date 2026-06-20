import os from 'os';
import fsp from 'fs/promises';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScoutFinding } from './scout-findings-types.js';

const tmpVault = path.join(os.tmpdir(), `carina-obsidian-test-${process.pid}`);

const finding: ScoutFinding = {
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  scanRunId: null,
  targetId: 'app.example.com',
  accountId: 'account-1',
  tool: 'nmap',
  findingType: 'open_port',
  severity: 'critical',
  cvssScore: 9.8,
  title: 'CVE-2024-1234 nginx RCE on app.example.com',
  description: null,
  remediation: null,
  rawData: {},
  status: 'open',
  isNew: true,
  firstSeen: '2026-06-19T00:00:00.000Z',
  lastSeen: '2026-06-19T00:00:00.000Z',
  createdAt: '2026-06-19T00:00:00.000Z',
};

afterEach(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(tmpVault, { recursive: true, force: true });
});

describe('obsidian vault', () => {
  it('bootstraps vault structure', async () => {
    vi.stubEnv('OBSIDIAN_VAULT_PATH', tmpVault);
    vi.stubEnv('CARINA_OPERATOR', 'tester');

    const { bootstrapVault, getConfig } = await import('./obsidian-vault.js');
    const config = getConfig();
    await bootstrapVault(config);

    await expect(fsp.access(path.join(tmpVault, 'Dashboard.md'))).resolves.toBeUndefined();
    await expect(fsp.access(path.join(tmpVault, 'Tools', 'nmap.md'))).resolves.toBeUndefined();
    await expect(fsp.access(path.join(tmpVault, 'Templates', 'investigation-template.md'))).resolves.toBeUndefined();
    await expect(fsp.access(path.join(tmpVault, 'Playbooks', 'web-app-pentest.md'))).resolves.toBeUndefined();
  });

  it('creates investigation case folders and target profiles', async () => {
    vi.stubEnv('OBSIDIAN_VAULT_PATH', tmpVault);
    vi.stubEnv('CARINA_OPERATOR', 'tester');

    const {
      createInvestigation,
      findCasePath,
      getConfig,
      slugifyCaseId,
    } = await import('./obsidian-vault.js');

    const caseId = slugifyCaseId('Test nginx case');
    const casePath = await createInvestigation(getConfig(), {
      caseId,
      title: 'Test nginx case',
      severity: 'high',
      cvss: 7.5,
      tags: ['nginx', 'test'],
      targets: ['app.example.com'],
      org: 'Example Corp',
    });

    expect(casePath).toContain(caseId);
    await expect(fsp.access(path.join(casePath, 'index.md'))).resolves.toBeUndefined();
    await expect(fsp.access(path.join(casePath, 'timeline.md'))).resolves.toBeUndefined();
    await expect(fsp.access(path.join(tmpVault, 'Targets', 'app.example.com.md'))).resolves.toBeUndefined();

    const found = await findCasePath(getConfig(), caseId);
    expect(found).toBe(casePath);
  });

  it('adds evidence and updates investigation index', async () => {
    vi.stubEnv('OBSIDIAN_VAULT_PATH', tmpVault);

    const {
      addEvidence,
      createInvestigation,
      getConfig,
      slugifyCaseId,
    } = await import('./obsidian-vault.js');

    const config = getConfig();
    const caseId = slugifyCaseId('Evidence case');
    const casePath = await createInvestigation(config, {
      caseId,
      title: 'Evidence case',
      severity: 'medium',
      cvss: 5.0,
      tags: ['test'],
      targets: ['host.example.com'],
      org: 'Test Org',
    });

    const evidencePath = await addEvidence(config, {
      caseId,
      casePath,
      tool: 'nmap',
      scanType: 'service',
      scanId: 'scan_1',
      target: 'host.example.com',
      output: 'PORT 443/tcp open https',
      status: 'completed',
      durationSeconds: 12.5,
    });

    expect(evidencePath).toContain('nmap-service.md');
    const index = await fsp.readFile(path.join(casePath, 'index.md'), 'utf-8');
    expect(index).toContain('  - nmap');
    expect(index).toContain('evidence_count: 1');
  });

  it('maps scout findings to investigation data and opens vault notes', async () => {
    vi.stubEnv('OBSIDIAN_VAULT_PATH', tmpVault);
    vi.stubEnv('CARINA_OPERATOR', 'laud');

    const {
      investigationDataFromScoutFinding,
      onInvestigationOpened,
      getVaultStats,
    } = await import('./obsidian-vault.js');

    const data = investigationDataFromScoutFinding(finding, { org: 'Example Corp' });
    expect(data.scoutFindingId).toBe(finding.id);
    expect(data.targets).toEqual(['app.example.com']);

    const casePath = await onInvestigationOpened(data);
    expect(casePath).toBeTruthy();

    const stats = await getVaultStats();
    expect(stats.openInvestigations).toBe(1);
    expect(stats.targetsMonitored).toBe(1);
  });

  it('closes investigations and searches vault content', async () => {
    vi.stubEnv('OBSIDIAN_VAULT_PATH', tmpVault);

    const {
      closeInvestigation,
      createInvestigation,
      findCasePath,
      getConfig,
      searchVault,
      slugifyCaseId,
    } = await import('./obsidian-vault.js');

    const config = getConfig();
    const caseId = slugifyCaseId('nginx search case');
    await createInvestigation(config, {
      caseId,
      title: 'nginx search case',
      severity: 'low',
      cvss: 2.0,
      tags: ['nginx'],
      targets: ['search.example.com'],
      org: 'Search Org',
    });

    await closeInvestigation(config, caseId);
    const foundPath = await findCasePath(config, caseId);
    expect(foundPath).toBeTruthy();
    const index = await fsp.readFile(path.join(foundPath!, 'index.md'), 'utf-8');
    expect(index).toContain('status: closed');

    const results = await searchVault(config, 'nginx');
    expect(results.some((r) => r.title.includes('nginx'))).toBe(true);
  });
});

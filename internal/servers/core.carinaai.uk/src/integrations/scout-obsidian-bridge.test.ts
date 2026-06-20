import os from 'os';
import fsp from 'fs/promises';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScoutFinding } from './scout-findings-types.js';

const tmpHome = path.join(os.tmpdir(), `carina-scout-bridge-test-${process.pid}`);
const tmpVault = path.join(os.tmpdir(), `carina-scout-bridge-vault-${process.pid}`);

const finding: ScoutFinding = {
  id: 'finding-bridge-1',
  scanRunId: null,
  targetId: 'app.example.com',
  accountId: 'account-1',
  tool: 'nmap',
  findingType: 'open_port',
  severity: 'high',
  cvssScore: 8.2,
  title: 'Open SSH on app.example.com',
  description: 'Port 22 exposed',
  remediation: 'Restrict SSH',
  rawData: {},
  status: 'investigating',
  isNew: false,
  firstSeen: '2026-06-19T00:00:00.000Z',
  lastSeen: '2026-06-19T00:00:00.000Z',
  createdAt: '2026-06-19T00:00:00.000Z',
};

afterEach(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(tmpHome, { recursive: true, force: true });
  await fsp.rm(tmpVault, { recursive: true, force: true });
});

describe('scout obsidian bridge', () => {
  it('opens scout investigation in obsidian and stores active context', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('OBSIDIAN_VAULT_PATH', tmpVault);
    vi.stubEnv('CARINA_OPERATOR', 'tester');

    const { saveInvestigation, getActiveInvestigationContext, loadInvestigation } = await import(
      './scout-investigations.js'
    );
    const { openScoutInvestigationInObsidian } = await import('./scout-obsidian-bridge.js');

    const investigation = await saveInvestigation({
      finding,
      toolsSuggested: ['nmap'],
      notes: 'Investigate SSH exposure',
    });

    const result = await openScoutInvestigationInObsidian(investigation, finding);
    expect(result?.casePath).toBeTruthy();

    const active = await getActiveInvestigationContext();
    expect(active?.investigationId).toBe(investigation.id);
    expect(active?.caseId).toBe('open-ssh-on-app-example-com');

    const updated = await loadInvestigation(investigation.id);
    expect(updated?.obsidianCasePath).toBe(result?.casePath);
    expect(updated?.status).toBe('in_progress');
  });

  it('records tool evidence and target updates for active investigation', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('OBSIDIAN_VAULT_PATH', tmpVault);

    const { saveInvestigation } = await import('./scout-investigations.js');
    const { openScoutInvestigationInObsidian, notifyScoutObsidianToolCompleted } = await import(
      './scout-obsidian-bridge.js'
    );

    const investigation = await saveInvestigation({
      finding,
      toolsSuggested: ['nmap'],
    });
    await openScoutInvestigationInObsidian(investigation, finding);

    const evidencePath = await notifyScoutObsidianToolCompleted({
      toolName: 'shell-exec',
      params: { command: 'nmap -sV app.example.com' },
      result: '22/tcp open ssh OpenSSH 8.9\n443/tcp open https nginx/1.24.0',
      durationMs: 4200,
      sessionId: 'session-1',
    });

    expect(evidencePath).toContain('nmap-service.md');

    const targetContent = await fsp.readFile(
      path.join(tmpVault, 'Targets', 'app.example.com.md'),
      'utf-8',
    );
    expect(targetContent).toContain('22: ssh');
    expect(targetContent).toContain('nginx/1.24.0');
  });

  it('resolves cyber tools from shell-exec commands', async () => {
    const { resolveObsidianTool } = await import('./scout-obsidian-bridge.js');

    expect(resolveObsidianTool('nuclei', { scanType: 'cve' })).toEqual({
      tool: 'nuclei',
      scanType: 'cve',
    });

    expect(resolveObsidianTool('shell-exec', { command: 'nmap -sS 10.0.0.1' })).toEqual({
      tool: 'nmap',
      scanType: 'syn',
    });
  });

  it('skips bridge when obsidian integration is disabled', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('OBSIDIAN_INTEGRATION', 'false');

    const { saveInvestigation } = await import('./scout-investigations.js');
    const { isObsidianBridgeEnabled, openScoutInvestigationInObsidian } = await import(
      './scout-obsidian-bridge.js'
    );

    expect(isObsidianBridgeEnabled()).toBe(false);

    const investigation = await saveInvestigation({
      finding,
      toolsSuggested: ['nmap'],
    });

    const result = await openScoutInvestigationInObsidian(investigation, finding);
    expect(result).toBeNull();
  });
});

import os from 'os';
import fsp from 'fs/promises';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScoutFinding } from './scout-findings-types.js';

const tmpHome = path.join(os.tmpdir(), `carina-scout-inv-test-${process.pid}`);

const finding: ScoutFinding = {
  id: 'finding-1',
  scanRunId: null,
  targetId: 'target-1',
  accountId: 'account-1',
  tool: 'nmap',
  findingType: 'open_port',
  severity: 'medium',
  cvssScore: null,
  title: 'Port 443 open',
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
  await fsp.rm(tmpHome, { recursive: true, force: true });
});

describe('scout investigations store', () => {
  it('tracks new findings since last pull', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    const { countNewFindings, readPullState, writePullState } = await import('./scout-investigations.js');

    await writePullState({ lastPullAt: '2026-06-18T00:00:00.000Z', findingIds: ['a'] });
    const state = await readPullState();
    expect(state.findingIds).toEqual(['a']);

    expect(countNewFindings([
      { ...finding, id: 'a' },
      { ...finding, id: 'b' },
    ], ['a'])).toBe(1);
  });

  it('saves investigation JSON under CARINA_HOME/data', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    const { saveInvestigation, listInvestigations, setActiveInvestigationContext, getActiveInvestigationContext } = await import('./scout-investigations.js');

    const investigation = await saveInvestigation({
      finding,
      toolsSuggested: ['nmap', 'security audit'],
      notes: 'Investigate port exposure',
    });

    expect(investigation.id).toBeTruthy();
    const listed = await listInvestigations();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.findingId).toBe('finding-1');

    await setActiveInvestigationContext({
      investigationId: investigation.id,
      findingId: finding.id,
      caseId: 'test-case',
      casePath: '/tmp/vault/case',
      targetId: finding.targetId,
      org: 'Test Org',
      openedAt: investigation.openedAt,
    });
    const active = await getActiveInvestigationContext();
    expect(active?.caseId).toBe('test-case');
  });
});

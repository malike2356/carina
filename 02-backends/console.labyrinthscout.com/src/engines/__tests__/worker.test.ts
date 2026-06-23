import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../registry.js', () => ({
  runEngine: vi.fn(),
}));

vi.mock('../../findings/store.js', () => ({
  claimNextQueuedScan: vi.fn(),
  completeScanRun: vi.fn(),
  createFinding: vi.fn(),
  failScanRun: vi.fn(),
}));

vi.mock('../../findings/score.js', () => ({
  getCurrentScoutScore: vi.fn(),
}));

import { runEngine } from '../registry.js';
import {
  claimNextQueuedScan,
  completeScanRun,
  createFinding,
  failScanRun,
} from '../../findings/store.js';
import { getCurrentScoutScore } from '../../findings/score.js';
import { runScanWorkerOnce } from '../worker.js';

describe('scan worker', () => {
  beforeEach(() => {
    vi.mocked(claimNextQueuedScan).mockReset();
    vi.mocked(runEngine).mockReset();
    vi.mocked(createFinding).mockReset();
    vi.mocked(completeScanRun).mockReset();
    vi.mocked(failScanRun).mockReset();
    vi.mocked(getCurrentScoutScore).mockReset();
  });

  it('does nothing when queue is empty', async () => {
    vi.mocked(claimNextQueuedScan).mockResolvedValue(null);
    await runScanWorkerOnce();
    expect(runEngine).not.toHaveBeenCalled();
  });

  it('runs engine and persists findings', async () => {
    vi.mocked(claimNextQueuedScan).mockResolvedValue({
      id: 'scan-1',
      targetId: 'target-1',
      accountId: 'acct-1',
      tool: 'nmap',
      status: 'running',
      startedAt: null,
      completedAt: null,
      findingsCount: 0,
      errorMessage: null,
      rawOutputPath: null,
      createdAt: '2026-06-19T10:00:00.000Z',
      target: 'example.com',
      targetType: 'domain',
    });
    vi.mocked(runEngine).mockResolvedValue({
      engine: 'nmap',
      findings: [{
        tool: 'nmap',
        findingType: 'open_port',
        severity: 'info',
        title: 'Open port 443',
      }],
    });
    vi.mocked(createFinding).mockResolvedValue({
      id: 'f1',
      scanRunId: 'scan-1',
      targetId: 'target-1',
      accountId: 'acct-1',
      tool: 'nmap',
      findingType: 'open_port',
      severity: 'info',
      cvssScore: null,
      title: 'Open port 443',
      description: null,
      remediation: null,
      rawData: {},
      status: 'open',
      isNew: true,
      firstSeen: '2026-06-19T10:00:00.000Z',
      lastSeen: '2026-06-19T10:00:00.000Z',
      createdAt: '2026-06-19T10:00:00.000Z',
    });
    vi.mocked(getCurrentScoutScore).mockResolvedValue({
      score: 95,
      openCritical: 0,
      openHigh: 0,
      openMedium: 0,
      openLow: 0,
      calculatedAt: '2026-06-19T10:00:00.000Z',
    });

    await runScanWorkerOnce();

    expect(runEngine).toHaveBeenCalledWith(
      'nmap',
      'example.com',
      'domain',
      'acct-1',
      'target-1',
    );
    expect(completeScanRun).toHaveBeenCalledWith('scan-1', 1);
    expect(getCurrentScoutScore).toHaveBeenCalledWith('acct-1', true);
  });

  it('marks scan failed on engine error', async () => {
    vi.mocked(claimNextQueuedScan).mockResolvedValue({
      id: 'scan-2',
      targetId: 'target-1',
      accountId: 'acct-1',
      tool: 'nuclei',
      status: 'running',
      startedAt: null,
      completedAt: null,
      findingsCount: 0,
      errorMessage: null,
      rawOutputPath: null,
      createdAt: '2026-06-19T10:00:00.000Z',
      target: 'example.com',
      targetType: 'domain',
    });
    vi.mocked(runEngine).mockRejectedValue(new Error('timeout'));

    await runScanWorkerOnce();

    expect(failScanRun).toHaveBeenCalledWith('scan-2', 'timeout');
  });
});

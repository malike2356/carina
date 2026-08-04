import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { EvalRunResult } from './types.js';

const mockResult: EvalRunResult = {
  runId: 'test-run-123',
  pack: 'productivity',
  label: 'test',
  passes: 1,
  startedAt: '2026-06-11T00:00:00.000Z',
  finishedAt: '2026-06-11T00:00:01.000Z',
  fixtureResults: [{
    fixtureId: 'trigger-notion',
    pass: false,
    latencyMs: 5,
    tokensUsed: 0,
    matchedSkills: ['google-workspace'],
    assertionResults: [{
      assertion: { type: 'skill_match', skill: 'notion-workspace' },
      passed: false,
      message: 'Expected notion-workspace',
    }],
  }],
  metrics: {
    passRate: 0,
    passCount: 0,
    failCount: 1,
    meanLatencyMs: 5,
    stdDevLatencyMs: 0,
    meanTokens: 0,
    stdDevTokens: 0,
    failuresByType: { skill_match: 1 },
  },
  thresholdsMet: false,
};

describe('report generation', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-eval-'));
    process.env.CARINA_HOME = tmpDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    delete process.env.CARINA_HOME;
  });

  it('generates markdown with summary and failures', async () => {
    const { generateMarkdownReport } = await import('./report.js');
    const md = generateMarkdownReport(mockResult);
    expect(md).toContain('# Skill Eval Report');
    expect(md).toContain('trigger-notion');
    expect(md).toContain('skill_match');
    expect(md).toContain('0.0%');
  });

  it('saves json and markdown report files', async () => {
    vi.resetModules();
    const { saveReport } = await import('./report.js');
    const report = await saveReport(mockResult);
    expect(report.runId).toBe('test-run-123');
    const jsonRaw = await fs.readFile(
      path.join(tmpDir, 'data', 'eval-reports', 'test-run-123.json'),
      'utf8',
    );
    const parsed = JSON.parse(jsonRaw) as { summary: string };
    expect(parsed.summary).toContain('productivity');
  });
});

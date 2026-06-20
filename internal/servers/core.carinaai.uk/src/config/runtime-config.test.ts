import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getAgentRuntimeOverride,
  getResolvedBudgetConfig,
  getResolvedTurnConfig,
  migrateRuntimeConfig,
  resolveTurnPolicy,
  validateRuntimeConfig,
} from './runtime-config.js';
import { setSessionConfig, clearSessionConfig } from './session-config.js';

let tmpDir = '';

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-runtime-config-'));
  delete process.env.CARINA_MAX_TURNS;
  delete process.env.CARINA_PARENT_ITERATION_BUDGET;
  delete process.env.CARINA_LLM_MONTHLY_BUDGET_USD;
});

afterEach(() => {
  clearSessionConfig('sess-1');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runtime-config', () => {
  it('uses env defaults when runtime.yaml is missing', () => {
    const configPath = path.join(tmpDir, 'missing.yaml');
    const turns = getResolvedTurnConfig(configPath);
    expect(turns.maxTurns).toBe(20);
    expect(turns.parentIterationBudget).toBe(90);
    expect(turns.subagentIterationBudget).toBe(50);
  });

  it('merges runtime.yaml overrides', () => {
    const configPath = path.join(tmpDir, 'runtime.yaml');
    fs.writeFileSync(configPath, [
      'version: 1',
      'turns:',
      '  max: 30',
      '  parentIterationBudget: 120',
      'agents:',
      '  research:',
      '    maxTurns: 12',
      '    iterationBudget: 40',
    ].join('\n'));

    expect(getResolvedTurnConfig(configPath).maxTurns).toBe(30);
    expect(getAgentRuntimeOverride('research', configPath)?.maxTurns).toBe(12);
    const policy = resolveTurnPolicy({ agentId: 'research', configPath });
    expect(policy.maxTurns).toBe(12);
    expect(policy.iterationBudget).toBe(40);
  });

  it('applies session overrides on top of agent config', () => {
    setSessionConfig('sess-1', { maxTurns: 5, iterationBudget: 8 });
    const policy = resolveTurnPolicy({ agentId: 'main', sessionOverrides: { maxTurns: 5, iterationBudget: 8 } });
    expect(policy.maxTurns).toBe(5);
    expect(policy.iterationBudget).toBe(8);
  });

  it('validates malformed runtime.yaml', () => {
    const configPath = path.join(tmpDir, 'runtime.yaml');
    fs.writeFileSync(configPath, 'turns:\n  max: not-a-number\n');
    const issues = validateRuntimeConfig(configPath);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('migrates missing runtime.yaml with defaults', () => {
    const configPath = path.join(tmpDir, 'runtime.yaml');
    const added = migrateRuntimeConfig(configPath);
    expect(fs.existsSync(configPath)).toBe(true);
    expect(added.length).toBeGreaterThan(0);
    expect(getResolvedBudgetConfig(configPath).turnWarnUsd).toBeGreaterThan(0);
  });

  it('reads monthly budget from env', () => {
    process.env.CARINA_LLM_MONTHLY_BUDGET_USD = '42.5';
    expect(getResolvedBudgetConfig(path.join(tmpDir, 'missing.yaml')).monthlyUsd).toBe(42.5);
  });
});

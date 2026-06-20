import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetRaspEngineForTests,
} from '../rasp/engine.js';
import {
  _clearBlockedSessions,
  _resetSuspendedFlag,
} from '../kill-switch-listener.js';
import {
  buildLatestReport,
  buildScheduleView,
  formatRedTeamReport,
  formatRedTeamResult,
  formatRedTeamSchedule,
  RedTeamAutomation,
  redTeamAutomation,
  shouldBlockRedTeamGaps,
} from './automation.js';
import { DEFAULT_RED_TEAM_EXERCISES, getExerciseById } from './exercises.js';
import { executeAttack, resetRedTeamAttackRuntime } from './attacks.js';
import { listDetectionRules } from './rules-store.js';
import { _resetRedTeamStoreForTests } from './store.js';

describe('red team exercises', () => {
  it('defines default scheduled exercises', () => {
    expect(DEFAULT_RED_TEAM_EXERCISES.length).toBe(3);
    expect(getExerciseById('weekly-prompt-injection')?.attackType).toBe('prompt_injection');
  });

  it('builds schedule view', async () => {
    const schedule = await buildScheduleView();
    expect(schedule.length).toBe(3);
    expect(formatRedTeamSchedule(schedule)).toContain('weekly-prompt-injection');
  });
});

describe('RedTeamAutomation', () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `carina-red-team-${Date.now()}`);
    process.env.CARINA_HOME = tmpHome;
    process.env.CARINA_RASP_ENABLED = 'true';
    process.env.CARINA_RED_TEAM_ENABLED = 'true';
    resetRedTeamAttackRuntime();
    _resetRaspEngineForTests();
    _resetSuspendedFlag();
    _clearBlockedSessions();
    await _resetRedTeamStoreForTests();
  });

  afterEach(async () => {
    resetRedTeamAttackRuntime();
    _resetRaspEngineForTests();
    await _resetRedTeamStoreForTests();
  });

  it('detects prompt injection payloads', async () => {
    const attack = await executeAttack('prompt_injection', 'sess-rt-1');
    expect(attack.detected).toBe(true);
    expect(attack.blocked).toBe(true);
    expect(attack.falsePositives).toBe(0);
  });

  it('detects tool sequence abuse', async () => {
    const attack = await executeAttack('tool_sequence_attack', 'sess-rt-2');
    expect(attack.detected).toBe(true);
    expect(attack.blocked).toBe(true);
  });

  it('blocks data exfiltration attempts', async () => {
    const attack = await executeAttack('data_exfiltration', 'sess-rt-3');
    expect(attack.detected).toBe(true);
    expect(attack.blocked).toBe(true);
  });

  it('runs an exercise and stores results', async () => {
    const result = await redTeamAutomation.runExercise('daily-tool-abuse', 'sess-run-1');
    expect(result.exerciseId).toBe('daily-tool-abuse');
    expect(result.detected).toBe(true);
    const report = await buildLatestReport();
    expect(report.results.some((row) => row.exerciseId === 'daily-tool-abuse')).toBe(true);
  });

  it('auto-creates detection rules for critical gaps', async () => {
    const automation = new RedTeamAutomation([
      {
        id: 'test-gap',
        name: 'Gap test',
        attackType: 'prompt_injection',
        mitreTactic: 'TA0040',
        targetSystems: ['prompt_guard'],
        schedule: '0 0 * * *',
        results: [],
      },
    ]);
    const gaps = automation.identifyGaps(
      {
        id: 'test-gap',
        name: 'Gap test',
        attackType: 'prompt_injection',
        mitreTactic: 'TA0040',
        targetSystems: ['prompt_guard'],
        schedule: '0 0 * * *',
        results: [],
      },
      {
        vector: 'test',
        systems: ['prompt_guard'],
        detected: false,
        blocked: false,
        detectionTimeMs: 0,
        blockTimeMs: 0,
        falsePositives: 0,
        details: {},
      },
    );
    await automation.autoCreateDetectionRule(gaps[0]!);
    const rules = await listDetectionRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(shouldBlockRedTeamGaps(gaps)).toBe(true);
  });
});

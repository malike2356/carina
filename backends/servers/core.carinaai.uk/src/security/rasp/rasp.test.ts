import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _clearBlockedSessions,
  _resetSuspendedFlag,
  getKillSwitchStatus,
  isSessionBlocked,
} from '../kill-switch-listener.js';
import { signalCorrelator } from './correlator.js';
import { classifyAttack, attackGraphBuilder } from './attack-graph.js';
import { decideResponse } from './response-dispatcher.js';
import {
  _resetRaspEngineForTests,
  emitRaspSignal,
  formatAttackGraph,
  formatThreatAssessment,
  getRaspEngine,
  isRaspEnabled,
} from './engine.js';
import { signalFromPromptGuard, signalFromToolSequence } from './adapters.js';
import { _resetRaspStoreForTests } from './store.js';

describe('RASP signal correlator', () => {
  it('boosts severity when multiple sources agree', () => {
    const now = Date.now();
    const buffer = [
      {
        id: 'a',
        source: 'prompt_guard' as const,
        type: 'injection',
        severity: 0.8,
        confidence: 0.8,
        timestamp: now,
        context: { sessionId: 'sess-1', agentId: 'agent', details: {} },
      },
      {
        id: 'b',
        source: 'tool_sequence' as const,
        type: 'rule-1',
        severity: 0.7,
        confidence: 0.9,
        timestamp: now,
        context: { sessionId: 'sess-1', agentId: 'agent', details: {} },
      },
    ];
    const correlated = signalCorrelator.correlate(buffer, buffer[1]!);
    expect(correlated[0]!.severity).toBeGreaterThan(0.8);
    expect(signalCorrelator.computeThreatScore(correlated)).toBeGreaterThan(50);
  });
});

describe('RASP attack graph', () => {
  it('classifies multi-source attacks', () => {
    const now = Date.now();
    const signals = [
      signalFromPromptGuard({ sessionId: 'sess-2', type: 'injection_blocked' }),
      signalFromToolSequence({
        sessionId: 'sess-2',
        toolName: 'shell-exec',
        ruleId: 'dangerous-chain',
        label: 'Dangerous chain',
        severity: 'critical',
      }),
    ].map((row, index) => ({
      ...row,
      timestamp: now + index,
      id: `sig-${index}`,
    }));
    const graph = attackGraphBuilder.build(signals);
    const classified = classifyAttack(signals, graph);
    expect(classified.attackType).toBe('prompt_injection_chain');
    expect(graph.length).toBe(2);
  });
});

describe('RASP engine', () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = path.join(os.tmpdir(), `carina-rasp-${Date.now()}`);
    process.env.CARINA_HOME = tmpHome;
    process.env.CARINA_RASP_ENABLED = 'true';
    _resetRaspEngineForTests();
    _resetSuspendedFlag();
    _clearBlockedSessions();
    await _resetRaspStoreForTests();
  });

  afterEach(async () => {
    _resetRaspEngineForTests();
    _resetSuspendedFlag();
    _clearBlockedSessions();
    await _resetRaspStoreForTests();
  });

  it('is enabled by default', () => {
    delete process.env.CARINA_RASP_ENABLED;
    expect(isRaspEnabled()).toBe(true);
  });

  it('decides kill response for critical correlated threats', () => {
    const decision = decideResponse(92, 'prompt_injection_chain', 0.8);
    expect(decision.action).toBe('kill');
    expect(decision.autoExecute).toBe(true);
  });

  it('ingests signals and produces threat assessment', async () => {
    const assessment = await emitRaspSignal(signalFromToolSequence({
      sessionId: 'sess-rasp-1',
      toolName: 'file-read',
      ruleId: 'test-rule',
      label: 'Suspicious sequence',
      severity: 'critical',
    }));
    expect(assessment).not.toBeNull();
    expect(assessment!.threatScore).toBeGreaterThan(0);
    expect(formatThreatAssessment(assessment!)).toContain('sess-rasp-1');
  });

  it('executes contain response for high score', async () => {
    const engine = getRaspEngine();
    const now = Date.now();
    await engine.ingest({
      ...signalFromToolSequence({
        sessionId: 'sess-contain',
        toolName: 'shell-exec',
        ruleId: 'critical-chain',
        label: 'Critical chain',
        severity: 'critical',
      }),
      timestamp: now,
    });
    const assessment = await engine.ingest({
      ...signalFromPromptGuard({
        sessionId: 'sess-contain',
        type: 'injection_blocked',
        severity: 0.95,
        confidence: 0.95,
      }),
      timestamp: now + 1,
    });
    expect(['contain', 'kill', 'alert']).toContain(assessment.decision.action);
    if (assessment.decision.action === 'contain' || assessment.decision.action === 'kill') {
      expect(isSessionBlocked('sess-contain') || getKillSwitchStatus().active).toBe(true);
    }
    expect(formatAttackGraph(assessment)).toContain('Attack graph');
  });
});

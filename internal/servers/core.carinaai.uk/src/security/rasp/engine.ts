import { randomUUID } from 'node:crypto';
import { attackGraphBuilder, classifyAttack } from './attack-graph.js';
import { CORRELATION_WINDOW_MS } from './signal-weights.js';
import { signalCorrelator } from './correlator.js';
import { decideResponse, executeResponse } from './response-dispatcher.js';
import {
  appendAssessment,
  assignSignalId,
  getAssessment,
  readAssessments,
} from './store.js';
import type { RASPSignal, RaspStatus, ThreatAssessment } from './types.js';
import {
  getKillSwitchStatus,
  isSessionBlocked,
} from '../kill-switch-listener.js';

export function isRaspEnabled(): boolean {
  return process.env.CARINA_RASP_ENABLED !== 'false';
}

export class RASPEngine {
  private signalBuffer: RASPSignal[] = [];
  private lastAssessment: ThreatAssessment | undefined;
  private readonly correlationWindowMs: number;

  constructor(correlationWindowMs = CORRELATION_WINDOW_MS) {
    this.correlationWindowMs = correlationWindowMs;
  }

  getActiveSignals(sessionId?: string): RASPSignal[] {
    this.prune(Date.now());
    if (!sessionId) return [...this.signalBuffer];
    return this.signalBuffer.filter((row) => row.context.sessionId === sessionId);
  }

  async ingest(signalInput: RASPSignal): Promise<ThreatAssessment> {
    const signal = assignSignalId(signalInput);
    this.signalBuffer.push(signal);
    this.prune(signal.timestamp);

    const correlatedSignals = signalCorrelator.correlate(this.signalBuffer, signal);
    const attackGraph = attackGraphBuilder.build(correlatedSignals);
    const threatScore = signalCorrelator.computeThreatScore(correlatedSignals);
    const confidence = signalCorrelator.computeConfidence(correlatedSignals);
    const { attackType, mitreTactic } = classifyAttack(correlatedSignals, attackGraph);
    const decision = decideResponse(threatScore, attackType, confidence);

    const assessment: ThreatAssessment = {
      id: randomUUID(),
      threatScore,
      confidence,
      attackType,
      mitreTactic,
      signals: correlatedSignals,
      attackGraph,
      decision,
      timestamp: Date.now(),
      sessionId: signal.context.sessionId,
    };

    if (decision.autoExecute && isRaspEnabled()) {
      await executeResponse(assessment);
      assessment.executed = true;
    }

    this.lastAssessment = assessment;
    await appendAssessment(assessment);
    return assessment;
  }

  async getThreatAssessment(id: string): Promise<ThreatAssessment | null> {
    if (this.lastAssessment?.id === id) return this.lastAssessment;
    return getAssessment(id);
  }

  buildStatus(): RaspStatus {
    const kill = getKillSwitchStatus();
    const assessments = this.lastAssessment ? 1 : 0;
    return {
      enabled: isRaspEnabled(),
      correlationWindowMs: this.correlationWindowMs,
      activeSignalCount: this.getActiveSignals().length,
      assessmentCount: assessments,
      lastAssessment: this.lastAssessment,
      suspended: kill.active,
      blockedSessionCount: this.countBlockedSessions(),
    };
  }

  reset(): void {
    this.signalBuffer = [];
    this.lastAssessment = undefined;
  }

  private prune(now: number): void {
    this.signalBuffer = this.signalBuffer.filter(
      (row) => now - row.timestamp < this.correlationWindowMs,
    );
  }

  private countBlockedSessions(): number {
    const sessions = new Set(
      this.signalBuffer.map((row) => row.context.sessionId).filter(Boolean),
    );
    let count = 0;
    for (const sessionId of sessions) {
      if (isSessionBlocked(sessionId)) count += 1;
    }
    return count;
  }
}

let engine: RASPEngine | null = null;

export function getRaspEngine(): RASPEngine {
  if (!engine) engine = new RASPEngine();
  return engine;
}

export function _resetRaspEngineForTests(): void {
  engine?.reset();
  engine = null;
}

export async function buildRaspStatus(): Promise<RaspStatus> {
  const stored = await readAssessments(1);
  const status = getRaspEngine().buildStatus();
  if (stored.length > 0) {
    status.assessmentCount = (await readAssessments(500)).length;
    status.lastAssessment = stored[stored.length - 1];
  }
  return status;
}

export function formatAttackGraph(assessment: ThreatAssessment): string {
  const lines = [
    `Attack graph for ${assessment.id}`,
    `Attack type: ${assessment.attackType ?? 'unknown'}`,
    `MITRE tactic: ${assessment.mitreTactic ?? 'unknown'}`,
    `Threat score: ${assessment.threatScore} (confidence ${assessment.confidence})`,
    '',
  ];
  for (const node of assessment.attackGraph) {
    lines.push(`  ${node.id} [${node.source}] ${node.label} severity=${node.severity.toFixed(2)}`);
    if (node.next?.length) {
      lines.push(`    -> ${node.next.join(', ')}`);
    }
  }
  return lines.join('\n');
}

export function formatThreatAssessment(assessment: ThreatAssessment): string {
  return [
    `Threat assessment ${assessment.id}`,
    `Session: ${assessment.sessionId}`,
    `Score: ${assessment.threatScore}/100 (confidence ${assessment.confidence})`,
    `Attack: ${assessment.attackType ?? 'unknown'} (${assessment.mitreTactic ?? 'n/a'})`,
    `Decision: ${assessment.decision.action} - ${assessment.decision.description}`,
    `Signals: ${assessment.signals.length}`,
    `Executed: ${assessment.executed ? 'yes' : 'no'}`,
  ].join('\n');
}

export function formatRaspStatus(status: RaspStatus): string {
  const lines = [
    `RASP engine: ${status.enabled ? 'enabled' : 'disabled'}`,
    `Correlation window: ${status.correlationWindowMs}ms`,
    `Active signals: ${status.activeSignalCount}`,
    `Assessments stored: ${status.assessmentCount}`,
    `Kill switch: ${status.suspended ? 'active' : 'inactive'}`,
    `Blocked sessions (tracked): ${status.blockedSessionCount}`,
  ];
  if (status.lastAssessment) {
    lines.push(
      `Last assessment: ${status.lastAssessment.id} score=${status.lastAssessment.threatScore}`,
    );
  }
  return lines.join('\n');
}

export async function emitRaspSignal(
  signal: Omit<RASPSignal, 'timestamp'> & { timestamp?: number },
): Promise<ThreatAssessment | null> {
  if (!isRaspEnabled()) return null;
  return getRaspEngine().ingest({
    ...signal,
    timestamp: signal.timestamp ?? Date.now(),
  });
}

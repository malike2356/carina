import {
  createDetectionRule,
  generatePatternForGap,
} from './rules-store.js';
import {
  appendResult,
  loadExercises,
  markExerciseRun,
  buildLatestReport,
} from './store.js';
import { DEFAULT_RED_TEAM_EXERCISES, describeScheduleHint, getExerciseById } from './exercises.js';
import { executeAttack, resetRedTeamAttackRuntime } from './attacks.js';
import type {
  AttackExecution,
  RedTeamExercise,
  RedTeamReport,
  RedTeamResult,
  RedTeamScheduleEntry,
  SecurityGap,
} from './types.js';

const DETECTION_SLA_MS = 50;

export class RedTeamAutomation {
  private exercises: RedTeamExercise[];

  constructor(exercises: RedTeamExercise[] = DEFAULT_RED_TEAM_EXERCISES) {
    this.exercises = exercises.map((row) => ({ ...row, results: [...(row.results ?? [])] }));
  }

  listExercises(): RedTeamExercise[] {
    return this.exercises;
  }

  async refreshExercises(): Promise<void> {
    this.exercises = await loadExercises();
  }

  async runExercise(exerciseId: string, sessionId = `red-team-${exerciseId}`): Promise<RedTeamResult> {
    const exercise = getExerciseById(exerciseId, this.exercises);
    if (!exercise) throw new Error(`Unknown exercise: ${exerciseId}`);

    resetRedTeamAttackRuntime();
    const attackResult = await executeAttack(exercise.attackType, sessionId);
    const gaps = this.identifyGaps(exercise, attackResult);

    for (const gap of gaps.filter((row) => row.severity === 'critical')) {
      await this.autoCreateDetectionRule(gap);
    }

    const result: RedTeamResult = {
      exerciseId,
      timestamp: Date.now(),
      attackVector: attackResult.vector,
      detected: attackResult.detected,
      detectionTime: attackResult.detectionTimeMs,
      blocked: attackResult.blocked,
      blockTime: attackResult.blockTimeMs,
      falsePositives: attackResult.falsePositives,
      gaps,
    };

    await appendResult(result);
    await markExerciseRun(exerciseId, result);
    exercise.lastRun = result.timestamp;
    exercise.results = [...(exercise.results ?? []), result].slice(-20);
    return result;
  }

  async runAll(sessionPrefix = 'red-team'): Promise<RedTeamResult[]> {
    const results: RedTeamResult[] = [];
    for (const exercise of this.exercises) {
      results.push(await this.runExercise(exercise.id, `${sessionPrefix}-${exercise.id}`));
    }
    return results;
  }

  identifyGaps(exercise: RedTeamExercise, attack: AttackExecution): SecurityGap[] {
    const gaps: SecurityGap[] = [];

    if (!attack.detected) {
      gaps.push({
        severity: 'critical',
        description: `${exercise.name} was not detected by ${exercise.targetSystems.join(', ')}`,
        system: exercise.targetSystems[0] ?? 'unknown',
        recommendation: `Review ${exercise.attackType} detection coverage and add regression tests`,
        autoCreatedRule: false,
      });
    }

    if (attack.detected && !attack.blocked) {
      gaps.push({
        severity: 'high',
        description: `${exercise.name} was detected but not blocked`,
        system: exercise.targetSystems[0] ?? 'unknown',
        recommendation: 'Ensure blocking enforcement is wired after detection',
        autoCreatedRule: false,
      });
    }

    if (attack.detected && attack.detectionTimeMs > DETECTION_SLA_MS) {
      gaps.push({
        severity: 'medium',
        description: `Detection took ${attack.detectionTimeMs}ms (SLA ${DETECTION_SLA_MS}ms)`,
        system: exercise.targetSystems[0] ?? 'unknown',
        recommendation: 'Optimize detection path latency for this attack type',
        autoCreatedRule: false,
      });
    }

    if (attack.falsePositives > 0) {
      gaps.push({
        severity: 'low',
        description: `${attack.falsePositives} benign probe(s) were flagged`,
        system: 'prompt_guard',
        recommendation: 'Tune detection rules to reduce false positives',
        autoCreatedRule: false,
      });
    }

    return gaps;
  }

  async autoCreateDetectionRule(gap: SecurityGap): Promise<void> {
    await createDetectionRule({
      name: `Auto-generated: ${gap.description}`,
      system: gap.system,
      pattern: generatePatternForGap(gap),
      severity: gap.severity,
      sourceGap: gap.description,
    });
    gap.autoCreatedRule = true;
  }
}

export const redTeamAutomation = new RedTeamAutomation();

export async function buildScheduleView(): Promise<RedTeamScheduleEntry[]> {
  const exercises = await loadExercises();
  return exercises.map((row) => ({
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    lastRun: row.lastRun ? new Date(row.lastRun).toISOString() : undefined,
    nextHint: describeScheduleHint(row.schedule),
  }));
}

export async function listUnresolvedGaps(): Promise<SecurityGap[]> {
  const report = await buildLatestReport();
  return report.unresolvedGaps;
}

export { buildLatestReport } from './store.js';

export function formatRedTeamReport(report: RedTeamReport): string {
  const lines = [
    `Red team report (${report.exercisesRun} exercises)`,
    `Generated: ${report.generatedAt}`,
    '',
  ];
  for (const result of report.results) {
    lines.push(
      `  ${result.exerciseId}: detected=${result.detected} blocked=${result.blocked} gaps=${result.gaps.length}`,
    );
  }
  if (report.unresolvedGaps.length > 0) {
    lines.push('', 'Unresolved gaps:');
    for (const gap of report.unresolvedGaps.slice(0, 10)) {
      lines.push(`  [${gap.severity}] ${gap.system}: ${gap.description}`);
    }
  }
  return lines.join('\n');
}

export function formatRedTeamSchedule(entries: RedTeamScheduleEntry[]): string {
  const lines = ['Red team exercise schedule', ''];
  for (const row of entries) {
    lines.push(`  ${row.id}`);
    lines.push(`    ${row.name}`);
    lines.push(`    Cron: ${row.schedule} (${row.nextHint})`);
    lines.push(`    Last run: ${row.lastRun ?? 'never'}`);
  }
  return lines.join('\n');
}

export function formatRedTeamResult(result: RedTeamResult): string {
  return [
    `Exercise: ${result.exerciseId}`,
    `Vector: ${result.attackVector}`,
    `Detected: ${result.detected} (${result.detectionTime}ms)`,
    `Blocked: ${result.blocked} (${result.blockTime}ms)`,
    `False positives: ${result.falsePositives}`,
    `Gaps: ${result.gaps.length}`,
  ].join('\n');
}

export function shouldBlockRedTeamGaps(
  gaps: SecurityGap[],
  failOn: 'critical' | 'high' = 'critical',
): boolean {
  if (failOn === 'high') {
    return gaps.some((row) => row.severity === 'critical' || row.severity === 'high');
  }
  return gaps.some((row) => row.severity === 'critical');
}

export function isRedTeamEnabled(): boolean {
  return process.env.CARINA_RED_TEAM_ENABLED !== 'false';
}

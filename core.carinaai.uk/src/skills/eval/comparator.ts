import { randomUUID } from 'crypto';
import { loadEvalDefinition } from './fixtures.js';
import { runEval, runEvalWithBaseline } from './runner.js';
import { compareMetrics } from './aggregate.js';
import type {
  BaselineComparison,
  BlindComparisonResult,
  CompareEvalOptions,
  EvalSkillOverride,
} from './types.js';

export function buildBaselineComparison(
  baseline: import('./types.js').EvalRunResult,
  candidate: import('./types.js').EvalRunResult,
): BaselineComparison {
  const cmp = compareMetrics(baseline.metrics, candidate.metrics, candidate.thresholds);
  const baselineFails = new Set(
    baseline.fixtureResults.filter((f) => !f.pass).map((f) => f.fixtureId),
  );
  const candidateFails = new Set(
    candidate.fixtureResults.filter((f) => !f.pass).map((f) => f.fixtureId),
  );

  const newFailures = [...candidateFails].filter((id) => !baselineFails.has(id));
  const fixedFixtures = [...baselineFails].filter((id) => !candidateFails.has(id));

  return {
    baseline,
    candidate,
    passRateDelta: cmp.passRateDelta,
    latencyDeltaMs: cmp.latencyDeltaMs,
    tokenDelta: cmp.tokenDelta,
    improved: cmp.improved,
    regression: cmp.regression,
    failingFixtures: [...candidateFails],
    newFailures,
    fixedFixtures,
  };
}

export async function compareEvalDefinitions(
  options: CompareEvalOptions,
): Promise<BaselineComparison> {
  const { def: baselineDef } = await loadEvalDefinition(options.baselinePath);
  const { def: candidateDef } = await loadEvalDefinition(options.candidatePath);
  const passes = options.passes ?? 3;
  const packOrPath = baselineDef.pack ?? options.baselinePath;

  const { baseline, candidate } = await runEvalWithBaseline(
    packOrPath,
    baselineDef.skills as EvalSkillOverride[] | undefined,
    candidateDef.skills as EvalSkillOverride[] | undefined,
    passes,
  );

  return buildBaselineComparison(baseline, candidate);
}

export async function blindCompare(
  pathA: string,
  pathB: string,
  passes = 3,
): Promise<BlindComparisonResult> {
  const comparisonId = randomUUID();
  const { def: defA } = await loadEvalDefinition(pathA);
  const { def: defB } = await loadEvalDefinition(pathB);
  const packOrPath = defA.pack ?? pathA;

  const [runA, runB] = await Promise.all([
    runEval({
      packOrPath,
      label: 'hidden-A',
      passes,
      skillsOverride: defA.skills,
    }),
    runEval({
      packOrPath,
      label: 'hidden-B',
      passes,
      skillsOverride: defB.skills,
    }),
  ]);

  const shuffleFirst = Math.random() < 0.5;
  const slotA = shuffleFirst ? runA : runB;
  const slotB = shuffleFirst ? runB : runA;
  const labelA = shuffleFirst ? pathA : pathB;
  const labelB = shuffleFirst ? pathB : pathA;

  let winner: 'A' | 'B' | 'tie' = 'tie';
  if (slotA.metrics.passRate > slotB.metrics.passRate) winner = 'A';
  else if (slotB.metrics.passRate > slotA.metrics.passRate) winner = 'B';
  else if (slotA.metrics.meanLatencyMs < slotB.metrics.meanLatencyMs) winner = 'A';
  else if (slotB.metrics.meanLatencyMs < slotA.metrics.meanLatencyMs) winner = 'B';

  const passRateDelta = slotA.metrics.passRate - slotB.metrics.passRate;
  const notes: string[] = [
    'Blind comparison: labels hidden until grading complete.',
    `Slot A pass rate: ${(slotA.metrics.passRate * 100).toFixed(1)}%`,
    `Slot B pass rate: ${(slotB.metrics.passRate * 100).toFixed(1)}%`,
  ];

  return {
    comparisonId,
    slotA: {
      slot: 'A',
      runId: slotA.runId,
      label: 'hidden',
      metrics: slotA.metrics,
    },
    slotB: {
      slot: 'B',
      runId: slotB.runId,
      label: 'hidden',
      metrics: slotB.metrics,
    },
    winner,
    revealed: {
      aLabel: labelA,
      bLabel: labelB,
    },
    passRateDelta,
    notes,
  };
}

export async function compareBaselineCandidate(
  packOrPath: string,
  baselineSkills?: EvalSkillOverride[],
  candidateSkills?: EvalSkillOverride[],
  passes = 3,
): Promise<BaselineComparison> {
  const { baseline, candidate } = await runEvalWithBaseline(
    packOrPath,
    baselineSkills,
    candidateSkills,
    passes,
  );
  return buildBaselineComparison(baseline, candidate);
}

import fs from 'fs/promises';
import path from 'path';
import { BUILTIN_PACKS_DIR } from '../pack-loader.js';
import { runEval } from './runner.js';
import { compareBaselineCandidate } from './comparator.js';
import { saveReport } from './report.js';
import {
  buildEvalDefinitionFromPack,
  deriveFixturesFromExamples,
  type UsageExample,
} from './derive-fixtures.js';
import type { EvalRunResult, EvalSkillOverride } from './types.js';

export interface AuthoringLoopOptions {
  packName: string;
  candidateSkills?: EvalSkillOverride[];
  baselineSkills?: EvalSkillOverride[];
  examples?: UsageExample[];
  passes?: number;
  minPassRate?: number;
  writeEvalFile?: boolean;
}

export interface AuthoringLoopResult {
  phase: 'draft' | 'fixtures' | 'benchmark' | 'review' | 'complete' | 'blocked';
  evalPath?: string;
  run?: EvalRunResult;
  comparison?: import('./types.js').BaselineComparison;
  reportPath?: string;
  approved: boolean;
  notes: string[];
}

export async function runAuthoringLoop(
  options: AuthoringLoopOptions,
): Promise<AuthoringLoopResult> {
  const notes: string[] = ['Phase 1: draft skill pack reviewed'];
  const packDir = path.join(BUILTIN_PACKS_DIR, options.packName);
  let evalPath = path.join(packDir, 'eval', 'eval.json');

  if (options.writeEvalFile !== false) {
    notes.push('Phase 2: generating eval fixtures');
    const { PACK_REGISTRY } = await import('../index.js');
    const pack = PACK_REGISTRY[options.packName];
    if (!pack) {
      return {
        phase: 'blocked',
        approved: false,
        notes: [`Unknown pack: ${options.packName}`],
      };
    }

    let fixtures = buildEvalDefinitionFromPack(options.packName, pack.skills).fixtures;
    if (options.examples?.length) {
      fixtures = [...fixtures, ...deriveFixturesFromExamples(options.examples)];
    }

    const def = {
      ...buildEvalDefinitionFromPack(options.packName, pack.skills),
      fixtures,
      thresholds: {
        minPassRate: options.minPassRate ?? 0.85,
        maxMeanLatencyMs: 100,
      },
    };

    if (options.candidateSkills) {
      (def as Record<string, unknown>).skills = options.candidateSkills;
    }

    await fs.mkdir(path.dirname(evalPath), { recursive: true });
    await fs.writeFile(evalPath, JSON.stringify(def, null, 2));
    notes.push(`Fixtures written to ${evalPath}`);
  } else {
    notes.push('Phase 2: using existing eval fixtures');
  }

  notes.push('Phase 3: running benchmark');
  const passes = options.passes ?? 3;

  if (options.baselineSkills || options.candidateSkills) {
    const comparison = await compareBaselineCandidate(
      options.packName,
      options.baselineSkills,
      options.candidateSkills,
      passes,
    );
    notes.push('Phase 4: review failures');
    if (comparison.newFailures.length > 0) {
      notes.push(`New failures: ${comparison.newFailures.join(', ')}`);
    }
    if (comparison.fixedFixtures.length > 0) {
      notes.push(`Fixed fixtures: ${comparison.fixedFixtures.join(', ')}`);
    }

    const minRate = options.minPassRate ?? 0.85;
    const approved = !comparison.regression
      && comparison.candidate.metrics.passRate >= minRate;

    notes.push(approved ? 'Phase 6: approved for packaging' : 'Phase 5: revise and rerun required');

    const report = await saveReport(comparison.candidate, comparison);
    return {
      phase: approved ? 'complete' : 'review',
      evalPath,
      run: comparison.candidate,
      comparison,
      reportPath: report.runId,
      approved,
      notes,
    };
  }

  const run = await runEval({
    packOrPath: options.packName,
    label: 'authoring',
    passes,
    skillsOverride: options.candidateSkills,
  });

  notes.push('Phase 4: review failures');
  const failing = run.fixtureResults.filter((f) => !f.pass).map((f) => f.fixtureId);
  if (failing.length > 0) {
    notes.push(`Failing fixtures: ${failing.join(', ')}`);
  }

  const minRate = options.minPassRate ?? 0.85;
  const approved = run.thresholdsMet && run.metrics.passRate >= minRate;
  notes.push(approved ? 'Phase 6: approved for packaging' : 'Phase 5: revise and rerun required');

  const report = await saveReport(run);
  return {
    phase: approved ? 'complete' : 'review',
    evalPath,
    run,
    reportPath: report.runId,
    approved,
    notes,
  };
}

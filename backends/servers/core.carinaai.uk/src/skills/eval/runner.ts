import path from 'path';
import { randomUUID } from 'crypto';
import { BUILTIN_PACKS_DIR } from '../pack-loader.js';
import type { PackSkillInput } from '../pack-types.js';
import { loadEvalDefinition } from './fixtures.js';
import { matchSkillsInMemory } from './match.js';
import { evaluateFixture } from './assertions.js';
import {
  aggregateFixtureResults,
  checkThresholds,
  mergePassResults,
} from './aggregate.js';
import { extractEvalKeywords } from './keywords.js';
import type {
  EvalFixture,
  EvalRunResult,
  EvalSkillOverride,
  FixtureRunResult,
  RunEvalOptions,
} from './types.js';

async function resolveSkills(
  packName: string,
  override?: EvalSkillOverride[],
): Promise<PackSkillInput[]> {
  if (override?.length) {
    return override.map((s) => ({
      name: s.name,
      description: s.description,
      trigger: s.trigger,
      steps: s.steps,
      toolsUsed: s.toolsUsed,
    }));
  }
  const { resolvePack } = await import('../pack-resolver.js');
  try {
    const pack = await resolvePack(packName);
    return pack.skills;
  } catch {
    throw new Error(`Unknown pack: ${packName}`);
  }
}

async function runSinglePass(
  skills: PackSkillInput[],
  fixtures: EvalFixture[],
  executeWithLlm: boolean,
): Promise<FixtureRunResult[]> {
  const results: FixtureRunResult[] = [];

  for (const fixture of fixtures) {
    const start = performance.now();
    const matched = matchSkillsInMemory(
      skills,
      fixture.input.query,
      fixture.input.keywords,
    );

    let output = fixture.input.simulateOutput ?? '';
    let tokensUsed = fixture.input.tokensUsed ?? 0;

    if (executeWithLlm && !output) {
      const llmResult = await invokeLlmForFixture(fixture.input.query, matched);
      output = llmResult.output;
      tokensUsed = llmResult.tokensUsed;
    }

    const latencyMs = performance.now() - start;
    const keywords = fixture.input.keywords ?? extractEvalKeywords(fixture.input.query);

    results.push(
      evaluateFixture(fixture, {
        matchedSkills: matched,
        output,
        latencyMs,
        tokensUsed,
        queryKeywords: keywords,
      }),
    );
  }

  return results;
}

async function invokeLlmForFixture(
  query: string,
  matched: ReturnType<typeof matchSkillsInMemory>,
): Promise<{ output: string; tokensUsed: number }> {
  const { llm } = await import('../../brain/llm.js');
  const skillContext = matched.length > 0
    ? `Relevant skill: ${matched[0].name}\n${matched[0].steps}`
    : 'No skill matched.';
  const response = await llm.chatCheap([
    {
      role: 'user',
      content: `Evaluate this skill routing fixture.\nQuery: ${query}\n${skillContext}\nRespond briefly with what action you would take.`,
      timestamp: new Date(),
    },
  ]);
  const tokensUsed = (response as { usage?: { total_tokens?: number } }).usage?.total_tokens ?? 0;
  return { output: response.content, tokensUsed };
}

export async function runEval(options: RunEvalOptions): Promise<EvalRunResult> {
  const { def, path: evalPath } = await loadEvalDefinition(options.packOrPath);
  const packName = def.pack ?? path.basename(path.dirname(evalPath));
  const label = options.label ?? 'current';
  const passes = Math.max(1, options.passes ?? 1);
  const skills = await resolveSkills(packName, options.skillsOverride ?? def.skills);

  const passResults: FixtureRunResult[][] = [];
  for (let i = 0; i < passes; i++) {
    passResults.push(await runSinglePass(skills, def.fixtures, options.executeWithLlm ?? false));
  }

  const fixtureResults = passes > 1
    ? mergePassResults(passResults)
    : passResults[0] ?? [];

  const metrics = aggregateFixtureResults(fixtureResults);
  const thresholdsMet = checkThresholds(metrics, def.thresholds);
  const startedAt = new Date().toISOString();

  return {
    runId: randomUUID(),
    pack: packName,
    label,
    passes,
    startedAt,
    finishedAt: new Date().toISOString(),
    fixtureResults,
    metrics,
    thresholds: def.thresholds,
    thresholdsMet,
    notes: thresholdsMet ? [] : ['One or more thresholds were not met'],
  };
}

export async function runEvalWithBaseline(
  packOrPath: string,
  baselineOverrides?: EvalSkillOverride[],
  candidateOverrides?: EvalSkillOverride[],
  passes = 3,
): Promise<{ baseline: EvalRunResult; candidate: EvalRunResult }> {
  const baseline = await runEval({
    packOrPath,
    label: 'baseline',
    passes,
    skillsOverride: baselineOverrides,
  });
  const candidate = await runEval({
    packOrPath,
    label: 'candidate',
    passes,
    skillsOverride: candidateOverrides,
  });
  return { baseline, candidate };
}

export function resolvePackEvalDir(packName: string): string {
  return path.join(BUILTIN_PACKS_DIR, packName);
}

export async function evalSkill(skill: {
  name: string;
  description: string;
  steps?: string;
  trigger?: string[];
}): Promise<{ pass: boolean }> {
  const hasSteps = Boolean(skill.steps?.trim());
  return {
    pass: Boolean(skill.name?.trim() && skill.description?.trim() && hasSteps),
  };
}

export { loadEvalDefinition, resolveSkills };

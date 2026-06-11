import { jaccardSimilarity } from '../store.js';
import type {
  AssertionResult,
  EvalAssertion,
  EvalFixture,
  FixtureRunResult,
} from './types.js';
import type { MatchedSkill } from './match.js';

export interface AssertionContext {
  matchedSkills: MatchedSkill[];
  output: string;
  latencyMs: number;
  tokensUsed: number;
  queryKeywords: string[];
}

export function evaluateAssertion(
  assertion: EvalAssertion,
  ctx: AssertionContext,
): AssertionResult {
  switch (assertion.type) {
    case 'skill_match':
      return evalSkillMatch(assertion, ctx);
    case 'skill_rank':
      return evalSkillRank(assertion, ctx);
    case 'keyword_overlap':
      return evalKeywordOverlap(assertion, ctx);
    case 'contains':
      return evalContains(assertion, ctx, true);
    case 'not_contains':
      return evalContains(assertion, ctx, false);
    case 'matches_regex':
      return evalRegex(assertion, ctx);
    case 'max_latency_ms':
      return evalMaxLatency(assertion, ctx);
    case 'max_tokens':
      return evalMaxTokens(assertion, ctx);
    case 'tools_include':
      return evalToolsInclude(assertion, ctx);
    default:
      return {
        assertion,
        passed: false,
        message: `Unknown assertion type: ${(assertion as EvalAssertion).type}`,
      };
  }
}

function evalSkillMatch(a: EvalAssertion, ctx: AssertionContext): AssertionResult {
  const expected = a.skill ?? '';
  const found = ctx.matchedSkills.some((s) => s.name === expected);
  return {
    assertion: a,
    passed: found,
    message: found
      ? `Skill "${expected}" matched`
      : `Expected skill "${expected}" not in [${ctx.matchedSkills.map((s) => s.name).join(', ')}]`,
  };
}

function evalSkillRank(a: EvalAssertion, ctx: AssertionContext): AssertionResult {
  const expected = a.skill ?? '';
  const rank = a.rank ?? 1;
  const idx = ctx.matchedSkills.findIndex((s) => s.name === expected);
  const passed = idx >= 0 && idx + 1 === rank;
  return {
    assertion: a,
    passed,
    message: passed
      ? `Skill "${expected}" at rank ${rank}`
      : `Expected "${expected}" at rank ${rank}, got ${idx >= 0 ? idx + 1 : 'none'}`,
  };
}

function evalKeywordOverlap(a: EvalAssertion, ctx: AssertionContext): AssertionResult {
  const min = a.min ?? 0.3;
  const targetKeywords = a.keywords?.length ? a.keywords : ctx.queryKeywords;
  let best = 0;
  let bestSkill = '';
  for (const skill of ctx.matchedSkills) {
    const score = jaccardSimilarity(targetKeywords, skill.trigger);
    if (score > best) {
      best = score;
      bestSkill = skill.name;
    }
  }
  const passed = best >= min;
  return {
    assertion: a,
    passed,
    message: passed
      ? `Keyword overlap ${best.toFixed(2)} >= ${min} (${bestSkill})`
      : `Keyword overlap ${best.toFixed(2)} < ${min}`,
  };
}

function evalContains(a: EvalAssertion, ctx: AssertionContext, shouldContain: boolean): AssertionResult {
  const needle = (a.value ?? '').toLowerCase();
  const hay = ctx.output.toLowerCase();
  const has = hay.includes(needle);
  const passed = shouldContain ? has : !has;
  return {
    assertion: a,
    passed,
    message: passed
      ? (shouldContain ? `Output contains "${a.value}"` : `Output does not contain "${a.value}"`)
      : (shouldContain ? `Output missing "${a.value}"` : `Output contains forbidden "${a.value}"`),
  };
}

function evalRegex(a: EvalAssertion, ctx: AssertionContext): AssertionResult {
  const pattern = a.pattern ?? '';
  let re: RegExp;
  try {
    re = new RegExp(pattern, 'i');
  } catch {
    return { assertion: a, passed: false, message: `Invalid regex: ${pattern}` };
  }
  const passed = re.test(ctx.output);
  return {
    assertion: a,
    passed,
    message: passed ? `Output matches /${pattern}/` : `Output does not match /${pattern}/`,
  };
}

function evalMaxLatency(a: EvalAssertion, ctx: AssertionContext): AssertionResult {
  const max = a.min ?? Number(a.value) ?? 5000;
  const passed = ctx.latencyMs <= max;
  return {
    assertion: a,
    passed,
    message: passed
      ? `Latency ${ctx.latencyMs.toFixed(1)}ms <= ${max}ms`
      : `Latency ${ctx.latencyMs.toFixed(1)}ms exceeds ${max}ms`,
  };
}

function evalMaxTokens(a: EvalAssertion, ctx: AssertionContext): AssertionResult {
  const max = a.min ?? Number(a.value) ?? 10000;
  const passed = ctx.tokensUsed <= max;
  return {
    assertion: a,
    passed,
    message: passed
      ? `Tokens ${ctx.tokensUsed} <= ${max}`
      : `Tokens ${ctx.tokensUsed} exceeds ${max}`,
  };
}

function evalToolsInclude(a: EvalAssertion, ctx: AssertionContext): AssertionResult {
  const required = a.tools ?? [];
  const skillName = a.skill;
  const skill = skillName
    ? ctx.matchedSkills.find((s) => s.name === skillName)
    : ctx.matchedSkills[0];
  if (!skill) {
    return { assertion: a, passed: false, message: `No skill found for tools_include` };
  }
  const missing = required.filter((t) => !skill.toolsUsed.includes(t));
  const passed = missing.length === 0;
  return {
    assertion: a,
    passed,
    message: passed
      ? `Skill "${skill.name}" includes tools [${required.join(', ')}]`
      : `Skill "${skill.name}" missing tools [${missing.join(', ')}]`,
  };
}

export function evaluateFixture(
  fixture: EvalFixture,
  ctx: AssertionContext,
): FixtureRunResult {
  const results = fixture.assertions.map((a) => evaluateAssertion(a, ctx));
  const pass = results.every((r) => r.passed);
  return {
    fixtureId: fixture.id,
    pass,
    latencyMs: ctx.latencyMs,
    tokensUsed: ctx.tokensUsed,
    matchedSkills: ctx.matchedSkills.map((s) => s.name),
    output: ctx.output || undefined,
    assertionResults: results,
  };
}

export function collectFailuresByType(results: FixtureRunResult[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const fr of results) {
    for (const ar of fr.assertionResults) {
      if (!ar.passed) {
        const t = ar.assertion.type;
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
  }
  return counts;
}

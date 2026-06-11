import fs from 'fs/promises';
import path from 'path';
import { BUILTIN_PACKS_DIR } from '../pack-loader.js';
import type { EvalAssertion, EvalDefinition, EvalFixture, EvalThresholds } from './types.js';

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,}/i,
  /password\s*[:=]\s*['"]?[^\s'"]{6,}/i,
  /AKIA[0-9A-Z]{16}/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
];

const VALID_ASSERTION_TYPES = new Set([
  'skill_match', 'skill_rank', 'keyword_overlap', 'contains', 'not_contains',
  'matches_regex', 'max_latency_ms', 'max_tokens', 'tools_include',
]);

export function validateAssertion(raw: unknown, fixtureId: string, index: number): EvalAssertion {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Fixture ${fixtureId}: assertion ${index} is not an object`);
  }
  const a = raw as Record<string, unknown>;
  const type = String(a.type ?? '');
  if (!VALID_ASSERTION_TYPES.has(type)) {
    throw new Error(`Fixture ${fixtureId}: unknown assertion type "${type}"`);
  }
  return {
    type: type as EvalAssertion['type'],
    skill: a.skill ? String(a.skill) : undefined,
    rank: a.rank !== undefined ? Number(a.rank) : undefined,
    min: a.min !== undefined ? Number(a.min) : undefined,
    value: a.value ? String(a.value) : undefined,
    pattern: a.pattern ? String(a.pattern) : undefined,
    tools: Array.isArray(a.tools) ? a.tools.map(String) : undefined,
    keywords: Array.isArray(a.keywords) ? a.keywords.map(String) : undefined,
    message: a.message ? String(a.message) : undefined,
  };
}

export function validateFixture(raw: unknown, index: number): EvalFixture {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Fixture at index ${index} is not an object`);
  }
  const f = raw as Record<string, unknown>;
  const id = String(f.id ?? `fixture-${index}`);
  const inputRaw = f.input;
  if (!inputRaw || typeof inputRaw !== 'object') {
    throw new Error(`Fixture ${id}: missing input object`);
  }
  const inputObj = inputRaw as Record<string, unknown>;
  const query = String(inputObj.query ?? '');
  if (!query) {
    throw new Error(`Fixture ${id}: input.query is required`);
  }
  scanForSensitive(query, id);

  const assertionsRaw = f.assertions;
  if (!Array.isArray(assertionsRaw) || assertionsRaw.length === 0) {
    throw new Error(`Fixture ${id}: at least one assertion is required`);
  }

  return {
    id,
    description: f.description ? String(f.description) : undefined,
    input: {
      query,
      keywords: Array.isArray(inputObj.keywords) ? inputObj.keywords.map(String) : undefined,
      simulateOutput: inputObj.simulateOutput ? String(inputObj.simulateOutput) : undefined,
      tokensUsed: inputObj.tokensUsed !== undefined ? Number(inputObj.tokensUsed) : undefined,
    },
    assertions: assertionsRaw.map((a, i) => validateAssertion(a, id, i)),
    tags: Array.isArray(f.tags) ? f.tags.map(String) : undefined,
  };
}

function validateThresholds(raw: unknown): EvalThresholds | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const t = raw as Record<string, unknown>;
  return {
    minPassRate: t.minPassRate !== undefined ? Number(t.minPassRate) : undefined,
    maxMeanLatencyMs: t.maxMeanLatencyMs !== undefined ? Number(t.maxMeanLatencyMs) : undefined,
    maxLatencyStdDevMs: t.maxLatencyStdDevMs !== undefined ? Number(t.maxLatencyStdDevMs) : undefined,
    maxMeanTokens: t.maxMeanTokens !== undefined ? Number(t.maxMeanTokens) : undefined,
    maxTokenDelta: t.maxTokenDelta !== undefined ? Number(t.maxTokenDelta) : undefined,
    maxRegressionDelta: t.maxRegressionDelta !== undefined ? Number(t.maxRegressionDelta) : undefined,
  };
}

export function validateEvalDefinition(raw: unknown): EvalDefinition {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Eval definition must be a JSON object');
  }
  const d = raw as Record<string, unknown>;
  const version = String(d.version ?? '1');
  const fixturesRaw = d.fixtures;
  if (!Array.isArray(fixturesRaw) || fixturesRaw.length === 0) {
    throw new Error('Eval definition must include a non-empty fixtures array');
  }

  const def: EvalDefinition = {
    version,
    pack: d.pack ? String(d.pack) : undefined,
    skill: d.skill ? String(d.skill) : undefined,
    description: d.description ? String(d.description) : undefined,
    thresholds: validateThresholds(d.thresholds),
    fixtures: fixturesRaw.map((f, i) => validateFixture(f, i)),
  };

  if (Array.isArray(d.skills)) {
    def.skills = d.skills.map((s, i) => {
      if (!s || typeof s !== 'object') {
        throw new Error(`skills[${i}] must be an object`);
      }
      const sk = s as Record<string, unknown>;
      return {
        name: String(sk.name ?? ''),
        description: String(sk.description ?? ''),
        trigger: Array.isArray(sk.trigger) ? sk.trigger.map(String) : [],
        steps: String(sk.steps ?? ''),
        toolsUsed: Array.isArray(sk.toolsUsed) ? sk.toolsUsed.map(String) : [],
      };
    });
  }

  return def;
}

export function scanForSensitive(text: string, context: string): void {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`Sensitive pattern found in ${context}; redact before storing fixtures`);
    }
  }
}

export async function loadEvalDefinition(source: string): Promise<{ def: EvalDefinition; path: string }> {
  let evalPath: string;

  if (source.endsWith('.json')) {
    evalPath = path.resolve(source);
  } else {
    const packDir = path.isAbsolute(source)
      ? source
      : path.join(BUILTIN_PACKS_DIR, source);
    const candidates = [
      path.join(packDir, 'eval', 'eval.json'),
      path.join(packDir, 'eval.json'),
    ];
    let found: string | null = null;
    for (const c of candidates) {
      try {
        await fs.access(c);
        found = c;
        break;
      } catch {
        // try next
      }
    }
    if (!found) {
      throw new Error(`No eval definition found for "${source}". Expected eval/eval.json or eval.json`);
    }
    evalPath = found;
  }

  const raw = JSON.parse(await fs.readFile(evalPath, 'utf8')) as unknown;
  const def = validateEvalDefinition(raw);
  return { def, path: evalPath };
}

export async function findEvalPathsForPack(packName: string): Promise<string[]> {
  const packDir = path.join(BUILTIN_PACKS_DIR, packName);
  const paths: string[] = [];
  for (const candidate of [
    path.join(packDir, 'eval', 'eval.json'),
    path.join(packDir, 'eval.json'),
  ]) {
    try {
      await fs.access(candidate);
      paths.push(candidate);
    } catch {
      // skip
    }
  }
  return paths;
}

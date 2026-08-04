import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { PROVIDER_BENCHMARK_FIXTURES } from './provider-fixtures.js';
import { queryProvider } from '../agents/compare.js';
import { llm } from '../brain/llm.js';
import { PROVIDER_MAP } from '../brain/provider-registry.js';
import type {
  ProviderBenchmarkFixture,
  ProviderBenchmarkFixtureResult,
  ProviderBenchmarkProviderId,
  ProviderBenchmarkProviderResult,
  ProviderBenchmarkRunReport,
} from './types.js';

const DEFAULT_PROVIDER_ORDER: ProviderBenchmarkProviderId[] = ['gemini', 'deepseek', 'anthropic'];

function readCarinaVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function newRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `provider-bench-${stamp}`;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function scoreFixture(
  fixture: ProviderBenchmarkFixture,
  response: string,
): { score: number; passed: boolean; failures: string[] } {
  const failures: string[] = [];
  const normalized = response.trim();
  const lower = normalized.toLowerCase();
  let score = 100;

  for (const expectation of fixture.expectations) {
    if (expectation.type === 'contains_all') {
      const missing = expectation.values.filter((value) => !lower.includes(value.toLowerCase()));
      if (missing.length > 0) {
        failures.push(`missing: ${missing.join(', ')}`);
        score -= 30;
      }
    } else if (expectation.type === 'contains_any') {
      const found = expectation.values.some((value) => lower.includes(value.toLowerCase()));
      if (!found) {
        failures.push(`none of: ${expectation.values.join(', ')}`);
        score -= 30;
      }
    } else if (expectation.type === 'not_contains') {
      const present = expectation.values.filter((value) => lower.includes(value.toLowerCase()));
      if (present.length > 0) {
        failures.push(`unexpected: ${present.join(', ')}`);
        score -= 20;
      }
    } else if (expectation.type === 'regex') {
      const pattern = new RegExp(expectation.pattern, 'i');
      if (!pattern.test(normalized)) {
        failures.push(`pattern mismatch: ${expectation.pattern}`);
        score -= 30;
      }
    } else if (expectation.type === 'json_keys') {
      const parsed = extractJson(normalized);
      if (!parsed) {
        failures.push('not valid json');
        score -= 40;
      } else {
        const missingKeys = expectation.keys.filter((key) => !(key in parsed));
        if (missingKeys.length > 0) {
          failures.push(`missing keys: ${missingKeys.join(', ')}`);
          score -= 30;
        }
      }
    } else if (expectation.type === 'max_words') {
      const words = countWords(normalized);
      if (words > expectation.value) {
        failures.push(`too long: ${words} words`);
        score -= 20;
      }
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, passed: failures.length === 0, failures };
}

async function runFixtureOnProvider(
  providerId: ProviderBenchmarkProviderId,
  fixture: ProviderBenchmarkFixture,
): Promise<ProviderBenchmarkFixtureResult> {
  const providerConfigured = llm.isProviderConfigured(providerId);
  if (!providerConfigured) {
    return {
      fixtureId: fixture.id,
      category: fixture.category,
      title: fixture.title,
      weight: fixture.weight,
      response: '',
      latencyMs: 0,
      tokensUsed: 0,
      score: 0,
      passed: false,
      failures: [`Provider ${providerId} is not configured`],
    };
  }

  const started = performance.now();
  const result = await queryProvider(
    providerId,
    fixture.prompt,
    fixture.systemPrompt,
    fixture.maxTokens,
    (messages, tools, override) => llm.chat(messages, tools, override),
  );
  const latencyMs = performance.now() - started;
  if (result.error) {
    return {
      fixtureId: fixture.id,
      category: fixture.category,
      title: fixture.title,
      weight: fixture.weight,
      response: '',
      latencyMs,
      tokensUsed: 0,
      score: 0,
      passed: false,
      failures: [result.error],
    };
  }
  const scored = scoreFixture(fixture, result.response);
  return {
    fixtureId: fixture.id,
    category: fixture.category,
    title: fixture.title,
    weight: fixture.weight,
    response: result.response,
    latencyMs: result.latencyMs || latencyMs,
    tokensUsed: result.tokenCount ?? 0,
    score: scored.score,
    passed: scored.passed,
    failures: scored.failures,
  };
}

function summarizeProvider(
  providerId: ProviderBenchmarkProviderId,
  fixtures: ProviderBenchmarkFixture[],
  results: ProviderBenchmarkFixtureResult[],
): ProviderBenchmarkProviderResult {
  const activeResults = results.filter((row) => row.fixtureId);
  const weightedTotal = activeResults.reduce((sum, row) => sum + (row.score * row.weight), 0);
  const weightSum = activeResults.reduce((sum, row) => sum + row.weight, 0) || 1;
  const passCount = activeResults.filter((row) => row.passed).length;
  const meanLatencyMs = activeResults.reduce((sum, row) => sum + row.latencyMs, 0) / Math.max(1, activeResults.length);
  const meanTokens = activeResults.reduce((sum, row) => sum + row.tokensUsed, 0) / Math.max(1, activeResults.length);
  const model = PROVIDER_MAP[providerId]?.defaultModel ?? providerId;
  return {
    providerId,
    model,
    status: 'configured',
    fixtures: results,
    weightedScore: Math.round((weightedTotal / weightSum) * 10) / 10,
    passRate: Math.round((passCount / Math.max(1, fixtures.length)) * 1000) / 1000,
    meanLatencyMs: Math.round(meanLatencyMs * 10) / 10,
    meanTokens: Math.round(meanTokens * 10) / 10,
  };
}

export async function runProviderBenchmark(
  providerIds: ProviderBenchmarkProviderId[] = DEFAULT_PROVIDER_ORDER,
): Promise<ProviderBenchmarkRunReport> {
  const providers: ProviderBenchmarkProviderResult[] = [];
  const comparison: ProviderBenchmarkRunReport['comparison'] = [];

  for (const providerId of providerIds) {
    if (!DEFAULT_PROVIDER_ORDER.includes(providerId)) {
      providers.push({
        providerId,
        model: providerId,
        status: 'skipped',
        reason: 'unsupported provider',
        fixtures: [],
        weightedScore: 0,
        passRate: 0,
        meanLatencyMs: 0,
        meanTokens: 0,
      });
      continue;
    }

    if (!llm.isProviderConfigured(providerId)) {
      providers.push({
        providerId,
        model: PROVIDER_MAP[providerId]?.defaultModel ?? providerId,
        status: 'skipped',
        reason: 'provider is not configured',
        fixtures: [],
        weightedScore: 0,
        passRate: 0,
        meanLatencyMs: 0,
        meanTokens: 0,
      });
      continue;
    }

    const providerFixtures = PROVIDER_BENCHMARK_FIXTURES;
    const results: ProviderBenchmarkFixtureResult[] = [];
    for (const fixture of providerFixtures) {
      results.push(await runFixtureOnProvider(providerId, fixture));
    }
    providers.push(summarizeProvider(providerId, providerFixtures, results));
  }

  for (const fixture of PROVIDER_BENCHMARK_FIXTURES) {
    comparison.push({
      fixtureId: fixture.id,
      category: fixture.category,
      title: fixture.title,
      results: providers.map((provider) => {
        const found = provider.fixtures.find((row) => row.fixtureId === fixture.id);
        return {
          providerId: provider.providerId,
          model: provider.model,
          score: found?.score ?? 0,
          latencyMs: found?.latencyMs ?? 0,
          tokensUsed: found?.tokensUsed ?? 0,
          passed: found?.passed ?? false,
          failures: found?.failures ?? ['not run'],
        };
      }),
    });
  }

  const best = [...providers]
    .filter((provider) => provider.status === 'configured')
    .sort((a, b) => b.weightedScore - a.weightedScore)[0];

  return {
    runId: newRunId(),
    generatedAt: new Date().toISOString(),
    carinaVersion: readCarinaVersion(),
    hostname: os.hostname(),
    methodology: 'Live prompt benchmark against actual provider APIs with shared fixtures and deterministic scoring.',
    disclaimer: 'This compares live provider responses on the same prompt pack. It is not a published vendor benchmark.',
    providers,
    fixtures: PROVIDER_BENCHMARK_FIXTURES,
    comparison,
    summary: {
      topProviderId: best?.providerId,
      topScore: best?.weightedScore,
      providerCount: providers.length,
      fixtureCount: PROVIDER_BENCHMARK_FIXTURES.length,
    },
  };
}

export function assertProviderBenchmarkReport(report: ProviderBenchmarkRunReport): void {
  if (report.providers.length === 0) {
    throw new Error('No providers were benchmarked');
  }
  const configured = report.providers.filter((provider) => provider.status === 'configured');
  if (configured.length === 0) {
    throw new Error('No configured providers were benchmarked');
  }
}

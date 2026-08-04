import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { Router } from 'express';
import { listModels } from '../lib/ai-platform.js';
import { resolveCarinaCliCommand } from '../lib/pty-bridge-core.js';

type BenchmarkCompetitor = {
  id: string;
  label: string;
  sourceNote: string;
  asOf: string;
  source?: string;
  dimensions: Record<string, number | null>;
};

type BenchmarkReport = {
  runId: string;
  generatedAt: string;
  carinaVersion: string;
  hostname: string;
  methodology: string;
  disclaimer: string;
  tasks: Array<{
    id: string;
    category: string;
    title: string;
    weight: number;
    observed: number | boolean | string | null;
    unit?: string;
    detail?: string;
    score: number;
    passedRegression: boolean;
    regressionMin?: number | null;
  }>;
  categories: Array<{
    category: string;
    taskCount: number;
    weightedScore: number;
    maxScore: number;
  }>;
  overall: {
    weightedScore: number;
    maxScore: number;
    percent: number;
    regressionPassed: boolean;
    failedRegressionTasks: string[];
  };
  competitors: BenchmarkCompetitor[];
  comparison: Array<{
    category: string;
    carinaScore: number;
    carinaObserved?: number | null;
    references: Array<{
      competitorId: string;
      label: string;
      referenceScore: number | null;
      delta: number | null;
    }>;
  }>;
};

type BenchmarkTask = {
  id: string;
  category: string;
  title: string;
  description: string;
  weight?: number;
  regressionMin?: number | null;
};

type ProviderBenchmarkReport = {
  runId: string;
  generatedAt: string;
  carinaVersion: string;
  hostname: string;
  methodology: string;
  disclaimer: string;
  providers: Array<{
    providerId: 'gemini' | 'deepseek' | 'anthropic';
    model: string;
    status: 'configured' | 'skipped' | 'failed';
    reason?: string;
    fixtures: Array<{
      fixtureId: string;
      category: string;
      title: string;
      weight: number;
      response: string;
      latencyMs: number;
      tokensUsed: number;
      score: number;
      passed: boolean;
      failures: string[];
    }>;
    weightedScore: number;
    passRate: number;
    meanLatencyMs: number;
    meanTokens: number;
  }>;
  fixtures: Array<{
    id: string;
    category: string;
    title: string;
    description: string;
    prompt: string;
    systemPrompt?: string;
    weight: number;
    maxTokens?: number;
  }>;
  comparison: Array<{
    fixtureId: string;
    category: string;
    title: string;
    results: Array<{
      providerId: 'gemini' | 'deepseek' | 'anthropic';
      model: string;
      score: number;
      latencyMs: number;
      tokensUsed: number;
      passed: boolean;
      failures: string[];
    }>;
  }>;
  summary: {
    topProviderId?: 'gemini' | 'deepseek' | 'anthropic';
    topScore?: number;
    providerCount: number;
    fixtureCount: number;
  };
};

const CARINA_HOME = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
const BENCHMARK_DIR = path.join(CARINA_HOME, 'benchmarks');

export const benchmarksRouter = Router();

function runCarinaBenchmark(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // Prefer the compiled CLI on CARINA_BIN / CARINA_CORE_ROOT. Do not use the
    // interactive docker PTY path (wrong CARINA_HOME) or pnpm (often missing in runtime images).
    const cmd = resolveCarinaCliCommand(['benchmark', ...args], { allowDockerPty: false });
    const child = spawn(cmd.file, cmd.args, {
      cwd: cmd.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `carina benchmark exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function loadLatestReport(): Promise<BenchmarkReport | null> {
  const latestPath = path.join(BENCHMARK_DIR, 'latest.json');
  try {
    const raw = JSON.parse(await fs.readFile(latestPath, 'utf8')) as BenchmarkReport;
    return raw;
  } catch {
    return null;
  }
}

async function loadLatestProviderReport(): Promise<ProviderBenchmarkReport | null> {
  const latestPath = path.join(BENCHMARK_DIR, 'latest.providers.json');
  try {
    const raw = JSON.parse(await fs.readFile(latestPath, 'utf8')) as ProviderBenchmarkReport;
    return raw;
  } catch {
    return null;
  }
}

async function listSavedRuns(): Promise<BenchmarkReport[]> {
  const entries = await fs.readdir(BENCHMARK_DIR).catch(() => []);
  const reports = await Promise.all(
    entries
      .filter((file) => file.startsWith('bench-') && file.endsWith('.json') && !file.includes('.public.'))
      .sort()
      .reverse()
      .slice(0, 24)
      .map(async (file) => {
        try {
          return JSON.parse(await fs.readFile(path.join(BENCHMARK_DIR, file), 'utf8')) as BenchmarkReport;
        } catch {
          return null;
        }
      }),
  );
  return reports.filter((report): report is BenchmarkReport => Boolean(report));
}

async function listSavedProviderRuns(): Promise<ProviderBenchmarkReport[]> {
  const entries = await fs.readdir(BENCHMARK_DIR).catch(() => []);
  const reports = await Promise.all(
    entries
      .filter((file) => file.startsWith('provider-bench-') && file.endsWith('.providers.json'))
      .sort()
      .reverse()
      .slice(0, 24)
      .map(async (file) => {
        try {
          return JSON.parse(await fs.readFile(path.join(BENCHMARK_DIR, file), 'utf8')) as ProviderBenchmarkReport;
        } catch {
          return null;
        }
      }),
  );
  return reports.filter((report): report is ProviderBenchmarkReport => Boolean(report));
}

async function loadReport(runId: string | null): Promise<BenchmarkReport | null> {
  if (!runId || runId === 'latest') return loadLatestReport();
  const file = path.join(BENCHMARK_DIR, `${runId}.json`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as BenchmarkReport;
  } catch {
    return null;
  }
}

async function loadTasks(): Promise<BenchmarkTask[]> {
  try {
    const raw = await runCarinaBenchmark(['list', '--json']);
    const parsed = JSON.parse(raw) as { tasks?: Array<{ id: string; category: string; title: string }> };
    return (parsed.tasks ?? []).map((task) => ({
      id: task.id,
      category: task.category,
      title: task.title,
      description: task.title,
    }));
  } catch {
    return [];
  }
}

async function loadComparison(): Promise<Array<{ category: string; carina: number; refs: Array<{ id: string; label: string; score: number | null; delta: number | null }> }>> {
  try {
    const raw = await runCarinaBenchmark(['compare', '--json']);
    const parsed = JSON.parse(raw) as {
      rows?: Array<{
        category: string;
        carina: number;
        competitorA: number | null;
        competitorB: number | null;
        competitorC: number | null;
      }>;
      competitors?: Array<{ id: string; label: string }>;
    };
    return (parsed.rows ?? []).map((row) => ({
      category: row.category,
      carina: row.carina,
      refs: [
        { id: 'competitor-a', label: parsed.competitors?.[0]?.label ?? 'Comp A', score: row.competitorA, delta: row.competitorA == null ? null : Math.round((row.carina - row.competitorA) * 10) / 10 },
        { id: 'competitor-b', label: parsed.competitors?.[1]?.label ?? 'Comp B', score: row.competitorB, delta: row.competitorB == null ? null : Math.round((row.carina - row.competitorB) * 10) / 10 },
        { id: 'competitor-c', label: parsed.competitors?.[2]?.label ?? 'Comp C', score: row.competitorC, delta: row.competitorC == null ? null : Math.round((row.carina - row.competitorC) * 10) / 10 },
      ],
    }));
  } catch {
    return [];
  }
}

benchmarksRouter.get('/', (_req, res) => {
  res.redirect('/benchmarks/runs');
});

function renderBenchmarks(
  req: { query: Record<string, unknown> },
  res: { render: (view: string, locals: Record<string, unknown>) => void },
  locals: Record<string, unknown>,
): void {
  res.render('benchmarks/index', {
    title: 'Benchmarks',
    saved: req.query.saved === '1',
    error: typeof req.query.err === 'string' ? req.query.err : '',
    latest: null,
    runs: [],
    tasks: [],
    comparison: [],
    report: null,
    models: [],
    providerLatest: null,
    providerRuns: [],
    selectedRun: 'latest',
    ...locals,
  });
}

benchmarksRouter.get('/runs', async (req, res) => {
  const latest = await loadLatestReport();
  const runs = await listSavedRuns();
  renderBenchmarks(req, res, {
    activeTab: 'runs',
    latest,
    runs,
  });
});

benchmarksRouter.post('/run', async (_req, res) => {
  try {
    await runCarinaBenchmark(['run', '--json']);
    res.redirect('/benchmarks/reports?saved=1');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect('/benchmarks/runs?err=' + encodeURIComponent(message));
  }
});

benchmarksRouter.get('/compare', async (req, res) => {
  const latest = await loadLatestReport();
  const comparison = latest?.comparison ?? await loadComparison();
  renderBenchmarks(req, res, {
    activeTab: 'compare',
    latest,
    comparison,
  });
});

benchmarksRouter.get('/fixtures', async (req, res) => {
  const [tasks, latest] = await Promise.all([loadTasks(), loadLatestReport()]);
  renderBenchmarks(req, res, {
    activeTab: 'fixtures',
    tasks,
    latest,
  });
});

benchmarksRouter.get('/providers', async (req, res) => {
  const [models, latest, providerLatest, providerRuns] = await Promise.all([
    listModels().catch(() => []),
    loadLatestReport(),
    loadLatestProviderReport(),
    listSavedProviderRuns(),
  ]);
  renderBenchmarks(req, res, {
    activeTab: 'providers',
    models,
    latest,
    providerLatest,
    providerRuns,
  });
});

benchmarksRouter.post('/providers/run', async (_req, res) => {
  try {
    await runCarinaBenchmark(['providers', '--json']);
    res.redirect('/benchmarks/providers?saved=1');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.redirect('/benchmarks/providers?err=' + encodeURIComponent(message));
  }
});

benchmarksRouter.get('/reports', async (req, res) => {
  const runId = typeof req.query.run === 'string' ? req.query.run : null;
  const [report, runs, latest] = await Promise.all([
    loadReport(runId),
    listSavedRuns(),
    loadLatestReport(),
  ]);
  renderBenchmarks(req, res, {
    activeTab: 'reports',
    report,
    runs,
    latest,
    selectedRun: runId ?? 'latest',
  });
});

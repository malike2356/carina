export type BenchmarkCategory =
  | 'tools'
  | 'skills'
  | 'channels'
  | 'memory'
  | 'routing'
  | 'sessions'
  | 'cron'
  | 'learning'
  | 'security'
  | 'marketplace'
  | 'platform';

export type BenchmarkMeasureResult = {
  observed: number | boolean | string;
  unit?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
};

export type BenchmarkTaskDefinition = {
  id: string;
  category: BenchmarkCategory;
  title: string;
  description: string;
  weight: number;
  regressionMin?: number;
  measure: () => Promise<BenchmarkMeasureResult>;
  score: (result: BenchmarkMeasureResult) => number;
};

export type BenchmarkTaskResult = {
  id: string;
  category: BenchmarkCategory;
  title: string;
  weight: number;
  observed: number | boolean | string;
  unit?: string;
  detail?: string;
  score: number;
  passedRegression: boolean;
  regressionMin?: number;
  metadata?: Record<string, unknown>;
};

export type BenchmarkCategorySummary = {
  category: BenchmarkCategory;
  taskCount: number;
  weightedScore: number;
  maxScore: number;
};

export type CompetitorReference = {
  id: string;
  label: string;
  source: 'published_reference';
  sourceNote: string;
  asOf: string;
  dimensions: Partial<Record<BenchmarkCategory, number | null>>;
};

export type BenchmarkRunReport = {
  runId: string;
  generatedAt: string;
  carinaVersion: string;
  hostname: string;
  methodology: string;
  disclaimer: string;
  tasks: BenchmarkTaskResult[];
  categories: BenchmarkCategorySummary[];
  overall: {
    weightedScore: number;
    maxScore: number;
    percent: number;
    regressionPassed: boolean;
    failedRegressionTasks: string[];
  };
  competitors: CompetitorReference[];
  comparison: Array<{
    category: BenchmarkCategory;
    carinaScore: number;
    carinaObserved?: number | boolean | string;
    references: Array<{ competitorId: string; label: string; referenceScore: number | null; delta: number | null }>;
  }>;
};

export type ProviderBenchmarkProviderId = 'gemini' | 'deepseek' | 'anthropic';

export type ProviderBenchmarkExpectation =
  | { type: 'contains_all'; values: string[] }
  | { type: 'contains_any'; values: string[] }
  | { type: 'not_contains'; values: string[] }
  | { type: 'regex'; pattern: string }
  | { type: 'json_keys'; keys: string[] }
  | { type: 'max_words'; value: number };

export type ProviderBenchmarkFixture = {
  id: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
  systemPrompt?: string;
  weight: number;
  maxTokens?: number;
  expectations: ProviderBenchmarkExpectation[];
};

export type ProviderBenchmarkFixtureResult = {
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
};

export type ProviderBenchmarkProviderResult = {
  providerId: ProviderBenchmarkProviderId;
  model: string;
  status: 'configured' | 'skipped' | 'failed';
  reason?: string;
  fixtures: ProviderBenchmarkFixtureResult[];
  weightedScore: number;
  passRate: number;
  meanLatencyMs: number;
  meanTokens: number;
};

export type ProviderBenchmarkRunReport = {
  runId: string;
  generatedAt: string;
  carinaVersion: string;
  hostname: string;
  methodology: string;
  disclaimer: string;
  providers: ProviderBenchmarkProviderResult[];
  fixtures: ProviderBenchmarkFixture[];
  comparison: Array<{
    fixtureId: string;
    category: string;
    title: string;
    results: Array<{
      providerId: ProviderBenchmarkProviderId;
      model: string;
      score: number;
      latencyMs: number;
      tokensUsed: number;
      passed: boolean;
      failures: string[];
    }>;
  }>;
  summary: {
    topProviderId?: ProviderBenchmarkProviderId;
    topScore?: number;
    providerCount: number;
    fixtureCount: number;
  };
};

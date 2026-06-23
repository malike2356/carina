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

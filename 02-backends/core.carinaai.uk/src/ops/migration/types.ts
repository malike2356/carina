export type MigrationSource = 'agent-type-1' | 'agent-type-2' | 'claude' | 'carina-bundle' | 'unknown';

export type MigrationItemStatus = 'imported' | 'partial' | 'skipped' | 'failed';

export type MigrationItem = {
  path: string;
  status: MigrationItemStatus;
  detail?: string;
};

export type MigrationReport = {
  version: number;
  source: MigrationSource;
  sourceType: string;
  sourceFormat: string;
  sourceDir: string;
  destDir: string;
  startedAt: string;
  finishedAt: string;
  items: MigrationItem[];
  warnings: string[];
  manualFollowUp: string[];
  backupLabel?: string;
  reportFile?: string;
  dryRun: boolean;
};

export type SourceScan = {
  source: MigrationSource;
  sourceType: string;
  dir: string;
  found: boolean;
  hints: string[];
};

export type MigrationOptions = {
  destDir?: string;
  sourceDir?: string;
  dryRun?: boolean;
  force?: boolean;
  skipBackup?: boolean;
};

export type MigrationPlan = {
  source: MigrationSource;
  sourceType: string;
  sourceDir: string;
  destDir: string;
  wouldImport: MigrationItem[];
  wouldSkip: MigrationItem[];
  wouldOverwrite: string[];
  warnings: string[];
  manualFollowUp: string[];
};

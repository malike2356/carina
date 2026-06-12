export type MigrationSource = 'hermes' | 'openclaw' | 'claude' | 'carina-bundle';

export type MigrationItemStatus = 'imported' | 'partial' | 'skipped' | 'failed';

export type MigrationItem = {
  path: string;
  status: MigrationItemStatus;
  detail?: string;
};

export type MigrationReport = {
  version: number;
  source: MigrationSource;
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
  sourceDir: string;
  destDir: string;
  wouldImport: MigrationItem[];
  wouldSkip: MigrationItem[];
  wouldOverwrite: string[];
  warnings: string[];
  manualFollowUp: string[];
};

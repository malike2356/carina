import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import { createBackup } from '../backup-restore.js';
import type { MigrationOptions, MigrationReport, MigrationSource, SourceScan } from './types.js';
import { migrate, migrateFromKnownHome } from './migrate.js';
import { discoverAgent, legacyAgentsManifestFilename } from './discovery.js';
import { migrateClaude, scanClaudeSources } from './claude.js';
import { exportCarinaBundle, importCarinaBundle } from './interop-bundle.js';

export type { MigrationReport, MigrationSource, SourceScan, MigrationItem, MigrationOptions, MigrationPlan } from './types.js';
export { exportCarinaBundle, importCarinaBundle, INTEROP_VERSION } from './interop-bundle.js';
export type { SelectiveExportFilters } from './interop-bundle.js';
export { migrate, migrateFromKnownHome } from './migrate.js';
export { discoverAgent, AGENT_SIGNATURES } from './discovery.js';

const KNOWN_AGENT_DIRS = [
  path.join(os.homedir(), '.hermes'),
  path.join(os.homedir(), '.openclaw'),
  path.join(os.homedir(), '.carina'),
];

const AGENT_TYPE_BY_HOME: Record<string, MigrationSource> = {
  '.hermes': 'agent-type-1',
  '.openclaw': 'agent-type-2',
};

export function sourceDir(source: MigrationSource): string | null {
  if (source === 'claude') {
    for (const dir of [
      path.join(os.homedir(), '.claude'),
      path.join(os.homedir(), '.config', 'Claude'),
      path.join(os.homedir(), 'Library', 'Application Support', 'Claude'),
    ]) {
      if (fsSync.existsSync(dir)) return dir;
    }
    return null;
  }
  if (source === 'carina-bundle' || source === 'unknown') return null;
  if (source === 'agent-type-1') return path.join(os.homedir(), '.hermes');
  if (source === 'agent-type-2') return path.join(os.homedir(), '.openclaw');
  return null;
}

function scanHints(dir: string): string[] {
  const hints: string[] = [];
  const manifest = legacyAgentsManifestFilename();
  for (const f of ['config.yaml', '.env', 'skills', 'credentials.json', manifest, 'profiles']) {
    if (fsSync.existsSync(path.join(dir, f))) hints.push(f);
  }
  return hints;
}

export async function scanMigrationSources(): Promise<SourceScan[]> {
  const scans: SourceScan[] = [];

  for (const dir of KNOWN_AGENT_DIRS) {
    const found = fsSync.existsSync(dir);
    const base = path.basename(dir);
    const sourceType = AGENT_TYPE_BY_HOME[base] ?? 'unknown';
    const agent = found ? discoverAgent(dir) : null;
    scans.push({
      source: agent?.id as MigrationSource ?? sourceType,
      sourceType: agent?.id ?? sourceType,
      dir,
      found,
      hints: found ? scanHints(dir) : [],
    });
  }

  scans.push(...await scanClaudeSources());
  const exportsDir = path.join(CARINA_HOME, 'exports');
  scans.push({
    source: 'carina-bundle',
    sourceType: 'carina-bundle',
    dir: exportsDir,
    found: fsSync.existsSync(exportsDir),
    hints: fsSync.existsSync(exportsDir)
      ? fsSync.readdirSync(exportsDir).filter((e) => fsSync.statSync(path.join(exportsDir, e)).isDirectory()).slice(0, 5)
      : [],
  });
  return scans;
}

function migrationsDir(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'migrations');
}

export async function saveMigrationReport(report: MigrationReport, homeDir = CARINA_HOME): Promise<string> {
  const dir = migrationsDir(homeDir);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${report.startedAt.replace(/[:.]/g, '-')}-${report.sourceType}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  return file;
}

export async function runMigration(
  source: MigrationSource,
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const destDir = options.destDir ?? CARINA_HOME;
  const dryRun = Boolean(options.dryRun);

  if (source === 'carina-bundle') {
    throw new Error('Use importCarinaBundle for carina-bundle imports');
  }

  let backupLabel: string | undefined;
  if (!dryRun && !options.skipBackup) {
    try {
      const backup = await createBackup({
        homeDir: destDir,
        label: `pre-migrate-${source}-${Date.now()}`,
        includePostgres: false,
      });
      backupLabel = backup.label;
    } catch {
      // warn after report built
    }
  }

  let report: MigrationReport;
  if (source === 'claude') {
    report = await migrateClaude(destDir, options.sourceDir, options);
    report = {
      ...report,
      sourceType: 'claude',
      sourceFormat: 'claude-settings',
    };
  } else if (source === 'agent-type-1' || source === 'agent-type-2') {
    report = await migrateFromKnownHome(source, destDir, options);
  } else if (options.sourceDir) {
    report = await migrate(options.sourceDir, destDir, options);
  } else {
    const srcDir = sourceDir(source) ?? '';
    if (!srcDir || !fsSync.existsSync(srcDir)) {
      report = {
        version: 1,
        source,
        sourceType: source,
        sourceFormat: 'unknown',
        sourceDir: srcDir,
        destDir,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        items: [{ path: srcDir, status: 'failed', detail: 'source directory not found' }],
        warnings: [],
        manualFollowUp: [`Set --from <path> or install source data under ${srcDir}`],
        dryRun,
      };
      if (backupLabel) report.backupLabel = backupLabel;
      return report;
    }
    report = await migrate(srcDir, destDir, options);
  }

  if (backupLabel) report.backupLabel = backupLabel;
  else if (!dryRun && !options.skipBackup) {
    report.warnings.push('Pre-migration backup failed; proceed only if you have a recent backup');
  }

  if (!dryRun) {
    report.reportFile = await saveMigrationReport(report, destDir);
  }

  return report;
}

export function formatMigrationReport(report: MigrationReport): string {
  const lines: string[] = [
    `Migration: ${report.sourceType}${report.dryRun ? ' (dry-run)' : ''}`,
    `  format: ${report.sourceFormat}`,
    `  from: ${report.sourceDir}`,
    `  to:   ${report.destDir}`,
  ];
  if (report.backupLabel) lines.push(`  backup: ${report.backupLabel}`);
  if (report.reportFile) lines.push(`  report: ${report.reportFile}`);
  lines.push('', 'Items:');
  for (const i of report.items) {
    lines.push(`  [${i.status.padEnd(8)}] ${i.path}${i.detail ? ` - ${i.detail}` : ''}`);
  }
  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const w of report.warnings) lines.push(`  - ${w}`);
  }
  if (report.manualFollowUp.length > 0) {
    lines.push('', 'Manual follow-up:');
    for (const m of report.manualFollowUp) lines.push(`  - ${m}`);
  }
  const imported = report.items.filter((i) => i.status === 'imported').length;
  const partial = report.items.filter((i) => i.status === 'partial').length;
  const skipped = report.items.filter((i) => i.status === 'skipped').length;
  const failed = report.items.filter((i) => i.status === 'failed').length;
  lines.push('', `Summary: ${imported} imported, ${partial} partial, ${skipped} skipped, ${failed} failed`);
  return lines.join('\n');
}

export function bundleImportReport(
  bundlePath: string,
  destDir: string,
  result: Awaited<ReturnType<typeof importCarinaBundle>>,
  dryRun: boolean,
): MigrationReport {
  const items = [
    ...result.restored.map((p) => ({ path: p, status: 'imported' as const, detail: dryRun ? 'would import' : undefined })),
    ...result.skipped.map((p) => ({ path: p, status: 'skipped' as const, detail: 'exists or missing' })),
  ];
  return {
    version: 1,
    source: 'carina-bundle',
    sourceType: 'carina-bundle',
    sourceFormat: 'carina-interop-bundle',
    sourceDir: bundlePath,
    destDir,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    items,
    warnings: result.skipped.length > 0 ? ['Some items skipped; use --force to overwrite existing paths'] : [],
    manualFollowUp: [
      'Run carina doctor && carina secrets audit',
      'Run carina memory reindex if using vector memory',
    ],
    dryRun,
  };
}

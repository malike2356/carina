import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import YAML from 'yaml';
import { CARINA_HOME } from '../../config/paths.js';
import { writeConfig, type CarinaCliConfig } from '../../cli/config/loader.js';
import { DEFAULT_CLI_CONFIG, type ProviderName } from '../../cli/config/defaults.js';
import type { MigrationItem, MigrationOptions, MigrationReport } from './types.js';
import { copyIfExistsSafe, listWouldOverwrite, mergeEnvFile } from './copy-utils.js';

const REPORT_VERSION = 1;

function item(pathRel: string, status: MigrationItem['status'], detail?: string): MigrationItem {
  return { path: pathRel, status, detail };
}

function mapProviders(parsed: Record<string, unknown>): CarinaCliConfig['providers'] {
  const providers = { ...DEFAULT_CLI_CONFIG.providers };
  const raw = parsed.providers;
  if (!raw || typeof raw !== 'object') return providers;
  for (const name of Object.keys(providers) as ProviderName[]) {
    const incoming = (raw as Record<string, unknown>)[name];
    if (!incoming || typeof incoming !== 'object') continue;
    const block = incoming as Record<string, unknown>;
    providers[name] = {
      ...providers[name],
      ...(typeof block.api_key === 'string' ? { api_key: block.api_key } : {}),
      ...(typeof block.model === 'string' ? { model: block.model } : {}),
    };
  }
  return providers;
}

function finishReport(
  base: Omit<MigrationReport, 'version' | 'dryRun' | 'manualFollowUp'>,
  manualFollowUp: string[],
  dryRun: boolean,
): MigrationReport {
  return { ...base, version: REPORT_VERSION, manualFollowUp, dryRun };
}

export async function migrateHermes(
  srcDir: string,
  destDir = CARINA_HOME,
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const startedAt = new Date().toISOString();
  const items: MigrationItem[] = [];
  const warnings: string[] = [];
  const manualFollowUp: string[] = [];
  const dryRun = Boolean(options.dryRun);
  const overwrite = Boolean(options.force);

  if (!dryRun) await fs.mkdir(destDir, { recursive: true });

  const destConfig = path.join(destDir, 'config.yaml');
  const srcConfig = path.join(srcDir, 'config.yaml');
  if (fsSync.existsSync(srcConfig)) {
    if (fsSync.existsSync(destConfig) && !overwrite) {
      items.push(item('config.yaml', 'skipped', 'dest exists; use --force to overwrite'));
      manualFollowUp.push('Merge Hermes config.yaml manually or re-run with --force');
    } else {
      try {
        const parsed = YAML.parse(await fs.readFile(srcConfig, 'utf-8')) as Record<string, unknown>;
        const modelSection = parsed.model;
        const provider = typeof modelSection === 'object' && modelSection && 'provider' in modelSection
          ? String((modelSection as Record<string, unknown>).provider)
          : DEFAULT_CLI_CONFIG.provider;
        const model = typeof modelSection === 'object' && modelSection && 'default' in modelSection
          ? String((modelSection as Record<string, unknown>).default)
          : (typeof parsed.model === 'string' ? parsed.model : DEFAULT_CLI_CONFIG.model);
        if (!dryRun) {
          await writeConfig({
            ...DEFAULT_CLI_CONFIG,
            provider: provider as typeof DEFAULT_CLI_CONFIG.provider,
            model,
            dataDir: destDir,
            providers: mapProviders(parsed),
          });
        }
        items.push(item('config.yaml', 'imported', 'provider, model, and providers mapped'));
      } catch (err) {
        items.push(item('config.yaml', 'failed', err instanceof Error ? err.message : String(err)));
      }
    }
  } else {
    items.push(item('config.yaml', 'skipped', 'not found in source'));
  }

  const envStatus = await mergeEnvFile(
    path.join(srcDir, '.env'),
    path.join(destDir, '.env'),
    dryRun,
  );
  items.push(item('.env', envStatus, envStatus === 'partial' ? 'merged missing keys only' : undefined));
  if (envStatus === 'partial') {
    manualFollowUp.push('Review merged .env keys; existing Carina values were kept');
  }

  const treeCopies: Array<{ src: string; dest: string; note?: string; partial?: boolean }> = [
    { src: 'skills', dest: 'packs', note: 'Hermes skills copied to packs/ (review pack.json)', partial: true },
    { src: 'memories', dest: 'data/memories', note: 'memory files; backend may need re-index' },
    { src: 'sessions', dest: 'sessions' },
    { src: 'profiles', dest: 'profiles', note: 'Hermes profiles copied; verify active-profile' },
    { src: 'cron', dest: 'data/cron' },
    { src: 'credentials.json', dest: 'credentials.json' },
    { src: 'hooks', dest: 'hooks' },
    { src: 'DREAMS.md', dest: 'DREAMS.md' },
  ];

  for (const { src, dest, note, partial } of treeCopies) {
    const srcPath = path.join(srcDir, src);
    const destPath = path.join(destDir, dest);
    if (!fsSync.existsSync(srcPath)) {
      items.push(item(dest, 'skipped'));
      continue;
    }
    const overwrites = await listWouldOverwrite(srcPath, destPath);
    if (overwrites.length > 0 && !overwrite) {
      items.push(item(dest, 'skipped', `${overwrites.length} path(s) exist; use --force`));
      manualFollowUp.push(`Hermes ${src} -> ${dest}: review ${overwrites.length} existing file(s) or use --force`);
      continue;
    }
    if (dryRun) {
      items.push(item(dest, partial ? 'partial' : 'imported', note ?? 'would copy'));
      continue;
    }
    const status = await copyIfExistsSafe(srcPath, destPath, overwrite);
    items.push(item(dest, partial ? 'partial' : status, note));
    if (src === 'skills') {
      warnings.push('Hermes skills imported as packs/; Carina pack manifests may need manual curation.');
      manualFollowUp.push('Review imported packs under packs/ and run carina packs list');
    }
    if (src === 'memories') {
      warnings.push('Memory import is file-level only; run: carina memory reindex');
      manualFollowUp.push('Run carina memory reindex if using vector memory');
    }
    if (src === 'profiles') {
      manualFollowUp.push('Run carina profile list and carina profile use <name> if needed');
    }
  }

  if (!fsSync.existsSync(path.join(srcDir, 'credentials.json'))) {
    warnings.push('No Hermes credentials.json found; API keys may only be in .env.');
  }

  return finishReport({
    source: 'hermes',
    sourceDir: srcDir,
    destDir,
    startedAt,
    finishedAt: new Date().toISOString(),
    items,
    warnings,
  }, manualFollowUp, dryRun);
}

export { REPORT_VERSION as HERMES_REPORT_VERSION };

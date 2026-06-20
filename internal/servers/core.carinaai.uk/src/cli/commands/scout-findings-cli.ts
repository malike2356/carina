import chalk from 'chalk';
import fsp from 'fs/promises';
import path from 'path';
import {
  fetchScoutStixBundle,
  getScoutFinding,
  getScoutScore,
  listScoutFindings,
  queueScoutScan,
  requestScoutInvestigation,
  resolveScoutApiConfig,
  ScoutFindingsApiError,
  updateScoutFindingStatus,
} from '../../integrations/scout-findings-api.js';
import type {
  ScoutFindingSeverity,
  ScoutFindingStatus,
  ScoutPullSummary,
} from '../../integrations/scout-findings-types.js';
import {
  countNewFindings,
  readPullState,
  loadInvestigation,
  saveInvestigation,
  summarizeSeverity,
  summarizeStatus,
  updateInvestigation,
  writePullState,
} from '../../integrations/scout-investigations.js';
import { resolveCarinaHome } from '../../config/paths.js';
import {
  formatInvestigationBrief,
  suggestToolsForFinding,
} from '../../integrations/scout-tool-suggestions.js';

export class ScoutCliConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScoutCliConfigError';
  }
}

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function requireApiConfig(): NonNullable<ReturnType<typeof resolveScoutApiConfig>> {
  const config = resolveScoutApiConfig();
  if (!config) {
    throw new ScoutCliConfigError(
      'LABYRINTH_API_KEY is not set. Configure Scout in ~/.carina/.env or run: carina scout enable',
    );
  }
  return config;
}

export async function runScoutPullCommand(args: string[]): Promise<void> {
  const config = requireApiConfig();
  const json = hasFlag(args, '--json');
  const severity = parseFlag(args, '--severity') as ScoutFindingSeverity | undefined;
  const status = parseFlag(args, '--status') as ScoutFindingStatus | undefined;
  const accountId = parseFlag(args, '--account-id') ?? config.accountId;

  const [findings, score, previous] = await Promise.all([
    listScoutFindings(config, {
      severity,
      status: status ?? 'open',
      accountId,
      limit: 200,
    }),
    getScoutScore(config).catch(() => null),
    readPullState(),
  ]);

  const summary: ScoutPullSummary = {
    pulledAt: new Date().toISOString(),
    scoutScore: score,
    total: findings.length,
    bySeverity: summarizeSeverity(findings) as ScoutPullSummary['bySeverity'],
    byStatus: summarizeStatus(findings) as ScoutPullSummary['byStatus'],
    newSinceLastPull: countNewFindings(findings, previous.findingIds),
    findings,
  };

  await writePullState({
    lastPullAt: summary.pulledAt,
    findingIds: findings.map((f) => f.id),
  });

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(chalk.bold('\nScout findings pull\n'));
  if (score) {
    console.log(`  Scout score: ${score.score}/100`);
    console.log(
      `  Open severities: critical ${score.openCritical}, high ${score.openHigh}, medium ${score.openMedium}, low ${score.openLow}`,
    );
  }
  console.log(`  Findings returned: ${summary.total}`);
  console.log(`  New since last pull: ${summary.newSinceLastPull}`);
  console.log(
    `  Severity breakdown: critical ${summary.bySeverity.critical}, high ${summary.bySeverity.high}, medium ${summary.bySeverity.medium}, low ${summary.bySeverity.low}, info ${summary.bySeverity.info}`,
  );

  if (findings.length === 0) {
    console.log(chalk.gray('\n  No findings matched the query.'));
    console.log('');
    return;
  }

  console.log(chalk.gray('\n  Top findings:'));
  for (const finding of findings.slice(0, 10)) {
    const badge = finding.severity === 'critical'
      ? chalk.red(finding.severity)
      : finding.severity === 'high'
        ? chalk.yellow(finding.severity)
        : chalk.gray(finding.severity);
    console.log(`  [${badge}] ${finding.title} (${finding.tool})`);
    console.log(chalk.gray(`    id: ${finding.id}  target: ${finding.targetId}`));
  }
  console.log('');
}

export async function runScoutInvestigateCommand(args: string[]): Promise<void> {
  const config = requireApiConfig();
  const json = hasFlag(args, '--json');
  const rest = args.filter((a) => a !== '--json');
  const findingId = rest[0];

  if (!findingId) {
    throw new ScoutCliConfigError('Usage: carina scout investigate <finding_id> [--json]');
  }

  const finding = await getScoutFinding(config, findingId);
  const tools = suggestToolsForFinding(finding);

  try {
    await requestScoutInvestigation(config, findingId);
  } catch {
    // Scout investigate endpoint optional when finding already investigating
  }

  let updatedFinding = finding;
  if (finding.status === 'open') {
    updatedFinding = await updateScoutFindingStatus(config, findingId, 'investigating');
  }

  const investigation = await saveInvestigation({
    finding: updatedFinding,
    toolsSuggested: tools,
    notes: formatInvestigationBrief(updatedFinding, tools),
    operatorId: process.env.USER ?? 'carina-cli',
  });

  let obsidianCasePath = '';
  try {
    const { openScoutInvestigationInObsidian } = await import(
      '../../integrations/scout-obsidian-bridge.js'
    );
    const sessionId = parseFlag(args, '--session');
    const obsidian = await openScoutInvestigationInObsidian(investigation, updatedFinding, {
      sessionId,
    });
    obsidianCasePath = obsidian?.casePath ?? '';
  } catch {
    // Obsidian integration is optional
  }

  if (json) {
    console.log(JSON.stringify({ investigation, toolsSuggested: tools, obsidianCasePath }, null, 2));
    return;
  }

  console.log(chalk.bold('\nScout investigation opened\n'));
  console.log(formatInvestigationBrief(updatedFinding, tools));
  console.log('');
  console.log(chalk.gray(`Investigation saved: ${investigation.id}`));
  if (obsidianCasePath) {
    console.log(chalk.gray(`Obsidian case: ${obsidianCasePath}`));
  }
  console.log(chalk.gray(`Finding status: ${updatedFinding.status}`));
  console.log('');
}

async function upsertEnvVar(filePath: string, key: string, value: string): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  let content = '';
  try {
    content = await fsp.readFile(filePath, 'utf-8');
  } catch {
    content = '';
  }
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const next = pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}${content.endsWith('\n') || content.length === 0 ? '' : '\n'}${line}\n`;
  await fsp.writeFile(filePath, next, { mode: 0o600 });
}

export async function runScoutConnectCommand(args: string[]): Promise<void> {
  const url = parseFlag(args, '--url')
    ?? parseFlag(args, '-u')
    ?? process.env.SCOUT_BASE_URL
    ?? 'http://localhost:4444';
  const apiKey = parseFlag(args, '--api-key') ?? parseFlag(args, '-k');
  const accountId = parseFlag(args, '--account-id');

  if (!apiKey) {
    throw new ScoutCliConfigError('Usage: carina scout connect --api-key <key> [--url URL] [--account-id UUID]');
  }

  const envPath = path.join(resolveCarinaHome(), '.env');
  await upsertEnvVar(envPath, 'LABYRINTH_ENABLED', 'true');
  await upsertEnvVar(envPath, 'SCOUT_ENABLED', 'true');
  await upsertEnvVar(envPath, 'LABYRINTH_API_KEY', apiKey);
  await upsertEnvVar(envPath, 'SCOUT_BASE_URL', url.replace(/\/+$/, ''));
  if (accountId) {
    await upsertEnvVar(envPath, 'SCOUT_ACCOUNT_ID', accountId);
  }

  process.env.LABYRINTH_ENABLED = 'true';
  process.env.SCOUT_ENABLED = 'true';
  process.env.LABYRINTH_API_KEY = apiKey;
  process.env.SCOUT_BASE_URL = url.replace(/\/+$/, '');
  if (accountId) process.env.SCOUT_ACCOUNT_ID = accountId;

  const config = resolveScoutApiConfig();
  let healthy = false;
  if (config) {
    try {
      await getScoutScore(config);
      healthy = true;
    } catch {
      healthy = false;
    }
  }

  console.log(chalk.bold('\nScout connected\n'));
  console.log(`  env file:  ${envPath}`);
  console.log(`  url:       ${url}`);
  console.log(`  api key:   set`);
  if (accountId) console.log(`  account:   ${accountId}`);
  console.log(`  health:    ${healthy ? chalk.green('ok') : chalk.yellow('unreachable (key saved)')}`);
  console.log('');
  console.log(chalk.gray('Next: carina scout pull'));
  console.log('');
}

export async function runScoutWatchCommand(args: string[]): Promise<void> {
  const config = requireApiConfig();
  const intervalSec = parseInt(parseFlag(args, '--interval') ?? '300', 10);
  const minSeverity = (parseFlag(args, '--severity') ?? 'high') as ScoutFindingSeverity;
  const once = hasFlag(args, '--once');
  const rank: Record<ScoutFindingSeverity, number> = {
    critical: 4, high: 3, medium: 2, low: 1, info: 0,
  };

  console.log(chalk.bold('\nScout watch\n'));
  console.log(`  interval:  ${intervalSec}s`);
  console.log(`  minimum:   ${minSeverity} and above`);
  console.log(chalk.gray('  Press Ctrl+C to stop.\n'));

  const seen = new Set<string>();

  const tick = async (): Promise<void> => {
    const findings = await listScoutFindings(config, { status: 'open', limit: 100 });
    const threshold = rank[minSeverity] ?? 3;
    const matched = findings.filter((f) => (rank[f.severity] ?? 0) >= threshold);
    const fresh = matched.filter((f) => !seen.has(f.id));
    for (const f of matched) seen.add(f.id);

    if (fresh.length > 0) {
      console.log(chalk.yellow(`[${new Date().toISOString()}] ${fresh.length} new finding(s)`));
      for (const f of fresh) {
        console.log(`  [${f.severity}] ${f.title} (${f.tool}) id=${f.id}`);
      }
    } else {
      console.log(chalk.gray(`[${new Date().toISOString()}] no new findings at ${minSeverity}+`));
    }
  };

  await tick();
  if (once) return;

  const timer = setInterval(() => {
    void tick().catch((err) => {
      console.error(chalk.red(formatScoutCliError(err)));
    });
  }, Math.max(intervalSec, 30) * 1000);

  await new Promise<void>((resolve) => {
    const stop = (): void => {
      clearInterval(timer);
      resolve();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });
}

export async function runScoutDeepScanCommand(args: string[]): Promise<void> {
  const config = requireApiConfig();
  const rest = args.filter((a) => !a.startsWith('--'));
  const targetId = rest[0];
  const tool = parseFlag(args, '--tool') ?? 'quick-scan';

  if (!targetId) {
    throw new ScoutCliConfigError('Usage: carina scout deep-scan <target_id> [--tool quick-scan|nmap|nuclei]');
  }

  const scan = await queueScoutScan(config, targetId, tool);
  console.log(chalk.bold('\nScout deep scan queued\n'));
  console.log(`  scan id:   ${scan.id}`);
  console.log(`  tool:      ${scan.tool}`);
  console.log(`  status:    ${scan.status}`);
  console.log(chalk.gray('\nPoll with: carina scout pull --status open'));
  console.log('');
}

export async function runScoutReportCommand(args: string[]): Promise<void> {
  const config = requireApiConfig();
  const json = hasFlag(args, '--json');
  const stixOnly = hasFlag(args, '--stix');
  const output = parseFlag(args, '--output');
  const rest = args.filter((a) => a !== '--json' && a !== '--stix' && a !== '--output' && !a.startsWith('--'));
  const investigationId = rest[0];

  let targetId: string | undefined;
  let findingTitle = 'account';

  if (investigationId) {
    const investigation = await loadInvestigation(investigationId);
    if (!investigation) {
      throw new ScoutCliConfigError(`Investigation not found: ${investigationId}`);
    }
    targetId = investigation.finding.targetId;
    findingTitle = investigation.finding.title;
  }

  const bundle = await fetchScoutStixBundle(config, targetId);
  const outPath = output
    ?? path.join(resolveCarinaHome(), 'data', `scout-report-${investigationId ?? 'account'}.stix.json`);

  if (!stixOnly && !json) {
    const score = await getScoutScore(config).catch(() => null);
    console.log(chalk.bold('\nScout report\n'));
    if (score) {
      console.log(`  Scout score: ${score.score}/100`);
    }
    console.log(`  subject:     ${findingTitle}`);
    const objects = Array.isArray((bundle as { objects?: unknown[] }).objects)
      ? (bundle as { objects: unknown[] }).objects.length
      : 0;
    console.log(`  STIX indicators: ${objects}`);
  }

  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, JSON.stringify(bundle, null, 2), { mode: 0o600 });

  if (investigationId) {
    await updateInvestigation(investigationId, { status: 'in_progress' });
    try {
      const { updateInvestigationRow } = await import('../../integrations/scout-investigations-persistence.js');
      await updateInvestigationRow(investigationId, { stixReportPath: outPath, status: 'in_progress' });
    } catch {
      // file/json report still written
    }
  }

  if (json) {
    console.log(JSON.stringify({ path: outPath, bundle }, null, 2));
    return;
  }

  console.log(chalk.gray(`\nSTIX bundle saved: ${outPath}`));
  console.log('');
}

export function formatScoutCliError(err: unknown): string {
  if (err instanceof ScoutCliConfigError || err instanceof ScoutFindingsApiError) {
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

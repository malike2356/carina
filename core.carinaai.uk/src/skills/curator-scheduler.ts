import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { pruneStaleSkills, runFullCuratorCycle } from './curator.js';
import { buildCuratorReviewReport, writeCuratorReviewReport } from './curator-report.js';
import { CARINA_HOME } from '../config/paths.js';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

function curatorReportsDir(): string {
  return process.env.CARINA_SKILL_CURATOR_REPORT_DIR ?? path.join(CARINA_HOME, 'data', 'curator-reports');
}

function curatorIntervalMs(): number {
  const hoursEnv = process.env.CARINA_SKILL_CURATOR_INTERVAL_HOURS;
  if (hoursEnv) {
    const hours = Math.max(1, Number(hoursEnv));
    return hours * 60 * 60 * 1000;
  }
  const days = Number(process.env.CARINA_CURATOR_INTERVAL_DAYS ?? '7');
  return Math.max(days, 1) * 24 * 60 * 60 * 1000;
}

function curatorLastRunFile(): string {
  return path.join(CARINA_HOME, 'data', 'curator-last-run.txt');
}

function writeCuratorLastRun(): void {
  try {
    const file = curatorLastRunFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, new Date().toISOString());
  } catch {
    // ignore write failures
  }
}

function curatorEnabled(): boolean {
  return process.env.CARINA_SKILL_CURATOR_ENABLED !== 'false';
}

async function runCuratorCycle(): Promise<void> {
  if (!curatorEnabled()) return;
  try {
    const hoursEnv = process.env.CARINA_SKILL_CURATOR_INTERVAL_HOURS;
    const intervalDays = Number(
      process.env.CARINA_CURATOR_INTERVAL_DAYS ?? (hoursEnv ? String(Number(hoursEnv) / 24) : '7'),
    );
    const result = await runFullCuratorCycle({ intervalDays });
    if (result.reportSummary) {
      console.log(chalk.gray(`[skill-curator] ${result.reportSummary}`));
    }

    const maxAgeDays = Number(process.env.CARINA_SKILL_CURATOR_MAX_AGE_DAYS ?? '90');
    const minUsage = Number(process.env.CARINA_SKILL_CURATOR_MIN_USAGE ?? '0');
    const report = await buildCuratorReviewReport({ maxAgeDays, minUsage });
    const dir = curatorReportsDir();
    fs.mkdirSync(dir, { recursive: true });
    await writeCuratorReviewReport(dir, report);

    const { pruned } = await pruneStaleSkills({ maxAgeDays, minUsage });
    if (pruned.length > 0) {
      console.log(chalk.gray(`[skill-curator] pruned ${pruned.length} stale skills`));
    }
    writeCuratorLastRun();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(chalk.yellow(`[skill-curator] cycle failed: ${msg}`));
  }
}

export function startSkillCuratorSchedule(): void {
  if (!curatorEnabled()) return;
  const ms = curatorIntervalMs();
  const lastRunFile = curatorLastRunFile();
  const lastRunMs = fs.existsSync(lastRunFile) ? fs.statSync(lastRunFile).mtimeMs : 0;
  const isOverdue = Date.now() - lastRunMs > ms;
  if (isOverdue) {
    void runCuratorCycle();
  }
  intervalHandle = setInterval(() => void runCuratorCycle(), ms);
  const hours = Math.round(ms / (60 * 60 * 1000));
  console.log(chalk.gray(`Skill curator enabled (every ${hours}h)`));
}

export function stopSkillCuratorSchedule(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

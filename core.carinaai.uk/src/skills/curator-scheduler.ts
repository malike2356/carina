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

async function runCuratorCycle(): Promise<void> {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(chalk.yellow(`[skill-curator] cycle failed: ${msg}`));
  }
}

export function startSkillCuratorSchedule(): void {
  if (process.env.CARINA_SKILL_CURATOR_ENABLED !== 'true') return;
  const intervalDays = Number(process.env.CARINA_CURATOR_INTERVAL_DAYS ?? '7');
  const ms = Math.max(intervalDays, 1) * 24 * 60 * 60 * 1000;
  void runCuratorCycle();
  intervalHandle = setInterval(() => void runCuratorCycle(), ms);
  console.log(chalk.gray(`Skill curator enabled (every ${intervalDays}d)`));
}

export function stopSkillCuratorSchedule(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

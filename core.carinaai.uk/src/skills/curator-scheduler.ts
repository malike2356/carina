import chalk from 'chalk';
import { pruneStaleSkills } from './curator.js';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startSkillCuratorSchedule(): void {
  if (process.env.CARINA_SKILL_CURATOR_ENABLED !== 'true') return;

  const hours = Number(process.env.CARINA_SKILL_CURATOR_INTERVAL_HOURS ?? '168');
  const maxAgeDays = Number(process.env.CARINA_SKILL_CURATOR_MAX_AGE_DAYS ?? '90');
  const minUsage = Number(process.env.CARINA_SKILL_CURATOR_MIN_USAGE ?? '0');
  const ms = Math.max(hours, 1) * 60 * 60 * 1000;

  const run = async () => {
    try {
      const { pruned } = await pruneStaleSkills({ maxAgeDays, minUsage });
      if (pruned.length > 0) {
        console.log(chalk.gray(`[skill-curator] pruned ${pruned.length} stale skills`));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(chalk.yellow(`[skill-curator] prune failed: ${msg}`));
    }
  };

  void run();
  intervalHandle = setInterval(() => void run(), ms);
  console.log(chalk.gray(`Skill curator enabled (every ${hours}h, max age ${maxAgeDays}d)`));
}

export function stopSkillCuratorSchedule(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

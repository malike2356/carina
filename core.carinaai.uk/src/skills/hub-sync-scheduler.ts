import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { CARINA_HOME } from '../config/paths.js';
import { syncSharedSkillsFromHub } from './cross-agent-hub-sync.js';

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function hubSyncEnabled(): boolean {
  if (process.env.CARINA_HUB_SYNC_ENABLED === 'false') return false;
  if (process.env.CARINA_LOCAL_MODE === 'true') return false;
  return Boolean(
    process.env.SKILLS_HUB_URL
    || process.env.HUB_URL
    || process.env.CARINA_HUB_SYNC_ENABLED === 'true',
  );
}

function hubSyncIntervalMs(): number {
  const hours = Number(process.env.CARINA_HUB_SYNC_INTERVAL_HOURS ?? '24');
  return Math.max(hours, 1) * 60 * 60 * 1000;
}

function hubSyncLastRunFile(): string {
  return path.join(CARINA_HOME, 'data', 'hub-sync-last-run.txt');
}

function writeHubSyncLastRun(): void {
  try {
    const file = hubSyncLastRunFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, new Date().toISOString());
  } catch {
    // ignore write failures
  }
}

async function runHubSyncCycle(): Promise<void> {
  if (!hubSyncEnabled()) return;
  try {
    const result = await syncSharedSkillsFromHub();
    writeHubSyncLastRun();
    if (result.merged > 0) {
      console.log(chalk.gray(
        `[hub-sync] merged ${result.merged} new shared skill(s) (${result.total} in index)`,
      ));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(chalk.yellow(`[hub-sync] cycle failed: ${msg}`));
  }
}

export function startHubSyncSchedule(): void {
  if (!hubSyncEnabled()) return;
  const ms = hubSyncIntervalMs();
  const lastRunFile = hubSyncLastRunFile();
  const lastRunMs = fs.existsSync(lastRunFile) ? fs.statSync(lastRunFile).mtimeMs : 0;
  const isOverdue = Date.now() - lastRunMs > ms;
  if (isOverdue) {
    void runHubSyncCycle();
  }
  intervalHandle = setInterval(() => void runHubSyncCycle(), ms);
  intervalHandle.unref?.();
  const hours = Math.round(ms / (60 * 60 * 1000));
  console.log(chalk.gray(`Hub skills sync enabled (every ${hours}h)`));
}

export function stopHubSyncSchedule(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export async function runHubSyncNow(): Promise<{ fetched: number; merged: number; total: number }> {
  const result = await syncSharedSkillsFromHub();
  writeHubSyncLastRun();
  return { fetched: result.fetched, merged: result.merged, total: result.total };
}

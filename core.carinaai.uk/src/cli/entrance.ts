import chalk from 'chalk';
import { llm } from '../brain/llm.js';
import { config } from '../config/index.js';
import { getActiveProfileName } from '../profiles/manager.js';
import { registry } from '../tools/index.js';

export type EntranceSurface = 'cli' | 'tui';

export interface EntranceSnapshot {
  profile: string;
  provider: string;
  model: string;
  toolCount: number;
  scoutSecured: boolean;
  memoryReady?: boolean;
  surface: EntranceSurface;
}

export const CLI_COMMAND_HINTS = ['/help', '/model', '/clear', '/exit'] as const;
export const TUI_COMMAND_HINTS = ['/help', '/profile', '/provider', '/quit'] as const;

export function commandHintsFor(surface: EntranceSurface): readonly string[] {
  return surface === 'tui' ? TUI_COMMAND_HINTS : CLI_COMMAND_HINTS;
}

function readActiveProvider(): { provider: string; model: string } {
  try {
    return { provider: llm.current().name, model: llm.currentModel() };
  } catch {
    return { provider: 'not configured', model: 'carina setup' };
  }
}

export function buildEntranceSnapshot(opts: {
  surface: EntranceSurface;
  memoryReady?: boolean;
  toolCount?: number;
}): EntranceSnapshot {
  const { provider, model } = readActiveProvider();
  return {
    profile: getActiveProfileName() ?? 'default',
    provider,
    model,
    toolCount: opts.toolCount ?? registry.list().length,
    scoutSecured: config.labyrinth.enabled,
    memoryReady: opts.memoryReady,
    surface: opts.surface,
  };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function providerLabel(snapshot: EntranceSnapshot, maxLen: number): string {
  const model = snapshot.model && snapshot.model !== snapshot.provider
    ? snapshot.model
    : '';
  const combined = model ? `${snapshot.provider} · ${model}` : snapshot.provider;
  return truncate(combined, maxLen);
}

function statusLabel(snapshot: EntranceSnapshot): string {
  if (snapshot.memoryReady === false) return 'memory: chat-only';
  return 'fast path ready';
}

function terminalWidth(): number {
  const cols = process.stdout.columns;
  return typeof cols === 'number' && cols >= 40 ? cols : 72;
}

export function buildEntranceLines(snapshot: EntranceSnapshot): string[] {
  const scout = snapshot.scoutSecured ? 'Scout-secured' : 'standalone';
  const width = terminalWidth();
  const providerMax = Math.max(24, width - 14);
  return [
    'CARINA',
    `Direct operator agent · ${scout}`,
    `profile: ${snapshot.profile} · provider: ${providerLabel(snapshot, providerMax)}`,
    `tools: ${snapshot.toolCount} · ${statusLabel(snapshot)}`,
  ];
}

export function buildFreshStartLines(snapshot: EntranceSnapshot): string[] {
  const width = terminalWidth();
  const providerMax = Math.max(24, width - 14);
  return [
    'Fresh start',
    `profile: ${snapshot.profile} · provider: ${providerLabel(snapshot, providerMax)}`,
    `tools: ${snapshot.toolCount} · ${statusLabel(snapshot)}`,
  ];
}

export function buildCommandFooter(surface: EntranceSurface, width = terminalWidth()): string {
  const hints = commandHintsFor(surface);
  const joined = hints.join('  ');
  if (joined.length <= width - 4) return joined;
  return hints.join(' ');
}

export function formatEntranceBlock(snapshot: EntranceSnapshot, variant: 'startup' | 'fresh-start' = 'startup'): string {
  const lines = variant === 'fresh-start'
    ? buildFreshStartLines(snapshot)
    : buildEntranceLines(snapshot);
  const footer = buildCommandFooter(snapshot.surface);
  return [...lines, footer].join('\n');
}

function printLines(lines: string[], footer: string): void {
  console.log('');
  console.log(chalk.bold.white(`  ${lines[0]}`));
  for (const line of lines.slice(1)) {
    console.log(chalk.gray(`  ${line}`));
  }
  console.log(chalk.cyan(`  ${footer}`));
  console.log('');
}

export function printEntrance(snapshot: EntranceSnapshot): void {
  printLines(buildEntranceLines(snapshot), buildCommandFooter(snapshot.surface));
}

export function printFreshStart(snapshot: EntranceSnapshot): void {
  printLines(buildFreshStartLines(snapshot), buildCommandFooter(snapshot.surface));
}

export function buildHelpFooterText(surface: EntranceSurface): string {
  return buildCommandFooter(surface);
}

import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import { llm } from '../brain/llm.js';
import { CarinaOrchestrator } from '../agents/orchestrator.js';
import {
  activateProfile,
  getActiveProfileName,
  listProfiles,
} from '../profiles/manager.js';
import {
  applyProfileProviderFromConfig,
  describeNamedProfileScope,
} from '../profiles/scope.js';
import { loadProfilePersonality, personalityToSystemSuffix } from '../profiles/personality.js';
import { getPromptCacheStats } from '../brain/prompt-cache.js';
import { KNOWN_LLM_PROVIDERS } from '../brain/provider-registry.js';
import { listCheckpoints, latestCheckpoint, restoreCheckpoint } from '../tools/checkpoint-store.js';
import { registry } from '../tools/index.js';
import { buildEntranceSnapshot, printEntrance, printFreshStart } from '../cli/entrance.js';

export interface TuiOptions {
  memoryReady?: boolean;
  sessionId?: string;
}

const HELP_LINES = [
  'CARINA TUI commands',
  '/help          show commands',
  '/profile       show or switch profile',
  '/provider      switch LLM provider',
  '/skills        show active skill packs',
  '/checkpoints   list recent checkpoints',
  '/restore       restore latest checkpoint',
  '/cache         prompt cache stats',
  '/quit          exit',
];

function printBanner(personalityName: string): void {
  printEntrance(buildEntranceSnapshot({
    surface: 'tui',
    memoryReady: true,
    toolCount: registry.list().length,
  }));
  console.log(chalk.gray(`  personality: ${personalityName}\n`));
}

async function reloadPersonality(agent: CarinaOrchestrator): Promise<string> {
  const personality = await loadProfilePersonality();
  const suffix = personalityToSystemSuffix(personality);
  agent.setSystemPromptSuffix(suffix);
  return personality.name;
}

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const sessionId = options.sessionId ?? `tui:${Date.now()}`;
  const agent = new CarinaOrchestrator(sessionId, options.memoryReady ?? false, undefined, {
    platform: 'cli',
  });

  let personalityName = await reloadPersonality(agent);
  printBanner(personalityName);

  let running = true;
  while (running) {
    const line = await input({ message: chalk.green('you>') });
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === '/quit' || trimmed === '/exit') {
      running = false;
      break;
    }

    if (trimmed === '/help') {
      for (const line of HELP_LINES) {
        console.log(chalk.gray(`  ${line}`));
      }
      continue;
    }

    if (trimmed === '/provider') {
      const configured = llm.list();
      const choice = await select({
        message: 'Select provider',
        choices: KNOWN_LLM_PROVIDERS.map((name) => ({
          name: configured.includes(name) ? `${name} (configured)` : `${name} (not configured)`,
          value: name,
          disabled: configured.includes(name) ? false : 'not configured',
        })),
      });
      llm.use(String(choice));
      console.log(chalk.yellow(`Switched to ${choice}`));
      continue;
    }

    if (trimmed.startsWith('/profile')) {
      const arg = trimmed.slice('/profile'.length).trim();

      if (!arg) {
        const name = getActiveProfileName() ?? 'default';
        try {
          const scope = describeNamedProfileScope(name, getActiveProfileName());
          console.log(chalk.yellow(JSON.stringify(scope, null, 2)));
        } catch {
          console.log(chalk.yellow(`Active profile: ${name} (no scope details)`));
        }
        continue;
      }

      if (arg === 'list') {
        const profiles = await listProfiles();
        const active = getActiveProfileName();
        for (const p of profiles) {
          console.log(active === p ? chalk.yellow(`* ${p}`) : `  ${p}`);
        }
        continue;
      }

      try {
        const profile = activateProfile(arg);
        applyProfileProviderFromConfig(profile);
        const configured = llm.list();
        const provider = process.env.DEFAULT_PROVIDER;
        if (provider && configured.includes(provider)) {
          llm.use(provider);
        }
        personalityName = await reloadPersonality(agent);
        console.log(chalk.yellow(`Switched to profile: ${profile.name}`));
        console.log(chalk.gray(`  Provider: ${llm.current().name} (${llm.currentModel()})`));
        console.log(chalk.gray(`  Personality: ${personalityName}`));
      } catch (err) {
        console.log(chalk.red(err instanceof Error ? err.message : String(err)));
      }
      continue;
    }

    if (trimmed === '/skills') {
      const packs = process.env.ACTIVE_SKILL_PACKS ?? process.env.ACTIVE_SKILL_PACK ?? '';
      console.log(chalk.yellow(packs ? `Active packs: ${packs}` : 'No active skill packs configured'));
      continue;
    }

    if (trimmed === '/checkpoints') {
      const checkpoints = await listCheckpoints(5);
      if (checkpoints.length === 0) {
        console.log(chalk.yellow('No checkpoints for this profile.'));
        continue;
      }
      for (const c of checkpoints) {
        const id = c.checkpoint_id.slice(0, 8);
        const label = c.label ?? '';
        const when = c.created_at ? c.created_at.slice(0, 19) : '';
        console.log(chalk.yellow(`  ${id}  ${label}  ${when}`));
      }
      continue;
    }

    if (trimmed === '/restore') {
      const latest = await latestCheckpoint();
      if (!latest) {
        console.log(chalk.yellow('No checkpoints to restore.'));
        continue;
      }
      const confirm = await input({
        message: `Restore latest (${latest.checkpoint_id.slice(0, 8)})? [y/N]`,
      });
      if (!/^y(es)?$/i.test(confirm.trim())) {
        console.log(chalk.gray('Restore cancelled.'));
        continue;
      }
      try {
        const result = await restoreCheckpoint(latest.checkpoint_id);
        console.log(chalk.yellow(`Restored ${result.restored.length} path(s)`));
      } catch (err) {
        console.log(chalk.red(err instanceof Error ? err.message : String(err)));
      }
      continue;
    }

    if (trimmed === '/cache') {
      const stats = getPromptCacheStats();
      console.log(chalk.yellow(`Prompt cache: size=${stats.size} hits=${stats.hits} misses=${stats.misses}`));
      continue;
    }

    process.stdout.write(chalk.green('\nCarina: '));
    for await (const event of agent.turn(trimmed)) {
      if (event.type === 'text' || event.type === 'tool' || event.type === 'status') {
        process.stdout.write(event.content);
      }
    }
    console.log('\n');
  }

  console.log(chalk.gray('Goodbye.\n'));
}

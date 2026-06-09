import chalk from 'chalk';
import { input, select } from '@inquirer/prompts';
import { llm } from '../brain/llm.js';
import { CarinaOrchestrator } from '../agents/orchestrator.js';
import { getActiveProfileName } from '../profiles/manager.js';
import { loadProfilePersonality, personalityToSystemSuffix } from '../profiles/personality.js';
import { getPromptCacheStats } from '../brain/prompt-cache.js';
import { KNOWN_LLM_PROVIDERS } from '../brain/provider-registry.js';

export interface TuiOptions {
  memoryReady?: boolean;
  sessionId?: string;
}

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const sessionId = options.sessionId ?? `tui:${Date.now()}`;
  const agent = new CarinaOrchestrator(sessionId, options.memoryReady ?? false);

  const personality = await loadProfilePersonality();
  const suffix = personalityToSystemSuffix(personality);
  if (suffix) agent.setSystemPromptSuffix(suffix);

  console.log(chalk.cyan.bold('\n  Carina TUI'));
  console.log(chalk.gray(`  Profile: ${getActiveProfileName() ?? 'default'}`));
  console.log(chalk.gray(`  Provider: ${llm.current().name} (${llm.currentModel()})`));
  console.log(chalk.gray(`  Personality: ${personality.name}`));
  console.log(chalk.gray('  Commands: /provider /profile /cache /quit\n'));

  let running = true;
  while (running) {
    const line = await input({ message: chalk.green('you>') });
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === '/quit' || trimmed === '/exit') {
      running = false;
      break;
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

    if (trimmed === '/profile') {
      const p = await loadProfilePersonality();
      console.log(chalk.yellow(personalityToSystemSuffix(p) || '(default personality)'));
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

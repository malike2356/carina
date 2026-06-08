import * as readline from 'readline';
import chalk from 'chalk';
import { llm } from '../brain/llm.js';
import { getRouter } from './router.js';
import { handleGatewayCommand, handleGatewayCommandAsync } from './commands.js';
import { listSkills } from '../skills/store.js';
import { registry } from '../tools/index.js';
import { CARINA_HOME } from '../config/paths.js';
import { loadWorkspaceContext } from '../workspace/context-files.js';
import { runBootstrapIfPresent } from '../workspace/bootstrap.js';
import type { ConfirmFn } from '../agents/tool-runner.js';
import type { CarinaMessage } from '../types/index.js';

let memoryReady = false;
let sessionId = '';
let workspaceContextCount = 0;
let bootstrapRan = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function handleCliOnlyCommand(input: string): boolean {
  if (input.startsWith('/recall')) {
    const parts = input.split(' ');
    const limit = parseInt(parts[1] ?? '10', 10) || 10;
    const router = getRouter();
    void router.recall(sessionId, limit).then((turns) => {
      if (turns.length === 0) {
        console.log(chalk.gray('\n  No turns in this session.\n'));
        return;
      }
      console.log(chalk.yellow(`\n  Last ${turns.length} turns:`));
      for (const t of turns) {
        const label = t.role === 'assistant' ? 'Carina' : 'You';
        const color = t.role === 'assistant' ? chalk.green : chalk.cyan;
        console.log(color(`  ${label}: ${t.content.slice(0, 200)}${t.content.length > 200 ? '...' : ''}`));
      }
      console.log('');
    });
    return true;
  }

  if (input === '/skills') {
    void listSkills().then((skills) => {
      if (skills.length === 0) {
        console.log(chalk.gray('\n  No skills saved yet.\n'));
        return;
      }
      console.log(chalk.yellow('\n  Saved skills:'));
      for (const s of skills) {
        console.log(chalk.white(`  - ${s.name}`));
        console.log(chalk.gray(`    ${s.description}`));
        console.log(chalk.gray(`    triggers: ${s.trigger.join(', ')}`));
        console.log(chalk.gray(`    used: ${s.usageCount}x`));
      }
      console.log('');
    });
    return true;
  }

  return false;
}

function prompt(): void {
  rl.question(chalk.cyan('\nYou: '), async (input) => {
    const trimmed = input.trim();
    if (!trimmed) { prompt(); return; }
    if (trimmed.toLowerCase() === 'exit' || trimmed === '/exit') {
      console.log(chalk.gray('\nCarina: Goodbye.\n'));
      process.exit(0);
    }

    if (handleCliOnlyCommand(trimmed)) { prompt(); return; }

    if (trimmed === '/clear') {
      await getRouter().clearSession(sessionId);
      console.log(chalk.yellow('\n  Session memory cleared.\n'));
      prompt();
      return;
    }

    const routeThroughGateway = trimmed.startsWith('/model') || trimmed.startsWith('/provider');
    const cmd = routeThroughGateway
      ? { handled: false as const }
      : trimmed.startsWith('/memories') || trimmed.startsWith('/usage')
      ? await handleGatewayCommandAsync(trimmed)
      : handleGatewayCommand(trimmed);
    if (cmd.handled) {
      if (cmd.action === 'clear') {
        await getRouter().clearSession(sessionId);
      }
      console.log(chalk.yellow(`\n  ${cmd.reply}\n`));
      if (cmd.action === 'exit') {
        process.exit(0);
      }
      prompt();
      return;
    }

    process.stdout.write(chalk.green('\nCarina: '));

    try {
      const router = getRouter();
      const carinaMsg: CarinaMessage = {
        id: String(Date.now()),
        sessionId,
        content: trimmed,
        source: 'cli',
        timestamp: new Date(),
      };

      for await (const chunk of router.handle(carinaMsg)) {
        process.stdout.write(chunk);
      }
      console.log('\n');
    } catch (err) {
      console.error(chalk.red('\nError: '), err);
    }

    prompt();
  });
}

export async function startCLI(opts: { memoryReady: boolean }): Promise<void> {
  if (!process.stdin.isTTY) {
    console.log(chalk.gray('CLI gateway skipped: no interactive terminal'));
    return;
  }

  memoryReady = opts.memoryReady;

  const router = getRouter();
  sessionId = await router.getSession('cli', 'local');
  const workspaceContext = await loadWorkspaceContext(CARINA_HOME);
  workspaceContextCount = workspaceContext.length;
  if (workspaceContext.length > 0) {
    router.setSessionSystemPromptSuffix(sessionId, workspaceContext.join('\n\n---\n\n'));
  }

  const confirmTool: ConfirmFn = (toolName, params, reason) =>
    new Promise((resolve) => {
      console.log(chalk.yellow(`\n  Tool confirmation: ${toolName}`));
      console.log(chalk.gray(`  ${reason}`));
      console.log(chalk.gray(`  Params: ${JSON.stringify(params).slice(0, 200)}`));
      rl.question(chalk.yellow('  Run this tool? (y/N): '), (answer) => {
        resolve(answer.trim().toLowerCase() === 'y');
      });
    });

  router.setConfirmHandler(confirmTool);
  bootstrapRan = await runBootstrapIfPresent(CARINA_HOME, async (instructions) => {
    for await (const _ of router.handle({
      id: `bootstrap-${Date.now()}`,
      sessionId,
      content: instructions,
      source: 'cli',
      timestamp: new Date(),
    })) {
      // consume the bootstrap turn; success is represented by the generator completing
    }
  });

  console.log(chalk.bold.white('\n  Carina Agent'));
  console.log(chalk.gray('  Built by VERLOX Ltd · carinaai.uk'));
  console.log(chalk.gray(`  Session: ${sessionId}`));
  console.log(chalk.gray(`  Provider: ${llm.list()[0]} (default)`));
  console.log(chalk.gray(`  Tools: ${registry.list().map((t) => t.name).join(', ')}`));
  console.log(chalk.gray(`  Workspace context: ${workspaceContextCount} file${workspaceContextCount === 1 ? '' : 's'} loaded from ${CARINA_HOME}`));
  if (bootstrapRan) {
    console.log(chalk.gray('  Bootstrap: BOOTSTRAP.md completed and removed'));
  }
  if (memoryReady) {
    console.log(chalk.gray('  Memory: PostgreSQL + pgvector active'));
  } else {
    console.log(chalk.gray('  Memory: unavailable (chat only)'));
  }
  console.log(chalk.gray('  Type /help for commands, /exit to quit\n'));
  console.log(chalk.green('CLI gateway ready'));

  prompt();
}

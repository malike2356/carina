import chalk from 'chalk';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  buildServeCommands,
  executeServeCommands,
  formatEnvBlock,
  formatHardwareLine,
  getCatalogEntry,
  listFittingModels,
  recommendFullStack,
  recommendModels,
  searchCatalog,
  getHardwareProfile,
} from '../../cookbook/index.js';
import type { CatalogEntry, ServeBackend } from '../../cookbook/types.js';

function parseVia(args: string[]): ServeBackend | undefined {
  const idx = args.indexOf('--via');
  if (idx < 0) return undefined;
  const raw = args[idx + 1];
  if (!raw) return undefined;
  const map: Record<string, ServeBackend> = {
    ollama: 'ollama',
    'llama.cpp': 'llama.cpp',
    llamacpp: 'llama.cpp',
    vllm: 'vllm',
    'lm-studio': 'lm-studio',
    lmstudio: 'lm-studio',
  };
  return map[raw.toLowerCase()];
}

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

function positionalArgs(args: string[]): string[] {
  const skip = new Set<number>();
  const viaIdx = args.indexOf('--via');
  if (viaIdx >= 0) {
    skip.add(viaIdx);
    if (viaIdx + 1 < args.length) skip.add(viaIdx + 1);
  }
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith('--')) skip.add(i);
  }
  return args.filter((_, i) => !skip.has(i));
}

function formatEntryLine(entry: CatalogEntry): string {
  const strengths = entry.strengths.join(', ');
  return `  ${entry.id.padEnd(22)} ${entry.paramCount.padEnd(4)} ${entry.quantization.padEnd(7)} ${entry.format.toUpperCase().padEnd(6)} ${String(entry.vramRequiredGb).padEnd(5)}GB  ${strengths}`;
}

function printDefaultOverview(): void {
  const profile = getHardwareProfile();
  const stack = recommendFullStack(profile);
  const rec = recommendModels(profile);

  console.log(`Hardware: ${formatHardwareLine(profile)}`);
  console.log(`Tier: ${stack.tier}`);
  console.log(`Scenario: ${stack.scenario}`);
  console.log('');
  console.log(stack.message);
  console.log('');
  console.log('Recommended local models (fit on your hardware):');
  if (stack.local.length === 0) {
    console.log('  (none fit; try carina playbook list --all or free disk/RAM)');
  } else {
    for (const entry of stack.local) {
      console.log(formatEntryLine(entry));
    }
  }
  console.log('');
  console.log('Cloud API options (configured providers marked with *):');
  for (const cloud of stack.cloud.slice(0, 5)) {
    const mark = cloud.configured ? '*' : ' ';
    console.log(`  ${mark} ${cloud.providerName.padEnd(16)} ${cloud.model.padEnd(24)} ${cloud.strengths.join(', ')}`);
  }
  if (stack.gapFillers.length > 0) {
    console.log('');
    console.log('Suggested cloud gap-fillers for this hardware:');
    for (const cloud of stack.gapFillers) {
      console.log(`  - ${cloud.providerName} (${cloud.model}): ${cloud.note}`);
    }
  }
  console.log('');
  if (rec.recommended[0]) {
    console.log(`Run \`carina playbook serve ${rec.recommended[0].id} --via ollama\` to get serve commands.`);
  }
  console.log('Run `carina playbook list --all` to see all 40+ local models.');
  console.log('Run `carina providers list` to configure cloud API keys.');
  console.log('');
}

function printInspect(id: string): void {
  const entry = getCatalogEntry(id);
  if (!entry) {
    console.error(`Unknown model: ${id}`);
    process.exit(1);
  }
  console.log(chalk.bold(`\n${entry.displayName} (${entry.id})\n`));
  console.log(`  family:         ${entry.family}`);
  console.log(`  params:         ${entry.paramCount}`);
  console.log(`  quantization:   ${entry.quantization}`);
  console.log(`  format:         ${entry.format}`);
  console.log(`  VRAM required:  ${entry.vramRequiredGb} GB`);
  console.log(`  RAM required:   ${entry.ramRequiredGb} GB`);
  console.log(`  disk:           ${entry.diskGb} GB`);
  console.log(`  context:        ${entry.contextWindow}`);
  console.log(`  license:        ${entry.license}`);
  console.log(`  strengths:      ${entry.strengths.join(', ')}`);
  console.log(`  serve via:      ${entry.serveVia.join(', ')}`);
  console.log(`  download URL:   ${entry.downloadUrl}`);
  console.log('');
  for (const via of entry.serveVia) {
    const cmds = buildServeCommands(entry, via);
    console.log(chalk.bold(`Serve via ${via}:`));
    for (const line of cmds.download) console.log(`  ${line}`);
    for (const line of cmds.serve) console.log(`  ${line}`);
    for (const line of formatEnvBlock(cmds.envKeys)) console.log(`  ${line}`);
    console.log('');
  }
}

async function printServe(id: string, via: ServeBackend | undefined, execute: boolean): Promise<void> {
  const entry = getCatalogEntry(id);
  if (!entry) {
    console.error(`Unknown model: ${id}`);
    process.exit(1);
  }
  const cmds = buildServeCommands(entry, via);
  console.log(chalk.bold(`\nServe ${entry.displayName} (${entry.id})\n`));
  console.log(chalk.gray('Download:'));
  for (const line of cmds.download) console.log(`  ${line}`);
  console.log(chalk.gray('\nServe:'));
  for (const line of cmds.serve) console.log(`  ${line}`);
  console.log(chalk.gray('\nCarina env keys:'));
  for (const line of formatEnvBlock(cmds.envKeys)) console.log(`  ${line}`);
  if (cmds.notes.length) {
    console.log(chalk.gray('\nNotes:'));
    for (const note of cmds.notes) console.log(`  ${note}`);
  }
  console.log('');

  if (execute) {
    const rl = readline.createInterface({ input, output });
    const confirm = async (prompt: string) => {
      const answer = await rl.question(prompt);
      rl.close();
      return answer.trim().toLowerCase() === 'yes';
    };
    await executeServeCommands(cmds, confirm);
  }
}

export async function runCookbookCommand(args: string[]): Promise<void> {
  const action = args[0];

  if (!action || action === 'help' || action === '--help') {
    console.log('Usage:');
    console.log('  carina playbook');
    console.log('  carina playbook list [--all]');
    console.log('  carina playbook search <query>');
    console.log('  carina playbook inspect <id>');
    console.log('  carina playbook serve <id> [--via ollama|llama.cpp|vllm|lm-studio] [--execute]');
    return;
  }

  if (action === 'list') {
    const profile = getHardwareProfile();
    const entries = listFittingModels(profile, flag(args, '--all'));
    console.log(chalk.bold(`\nModel catalog (${entries.length} entries)\n`));
    for (const entry of entries) {
      console.log(formatEntryLine(entry));
    }
    console.log('');
    return;
  }

  if (action === 'search') {
    const query = positionalArgs(args.slice(1)).join(' ');
    if (!query) {
      console.error('Usage: carina playbook search <query>');
      process.exit(1);
    }
    const results = searchCatalog(query);
    console.log(chalk.bold(`\nSearch: "${query}" (${results.length} matches)\n`));
    for (const entry of results) {
      console.log(formatEntryLine(entry));
    }
    console.log('');
    return;
  }

  if (action === 'inspect') {
    const id = positionalArgs(args.slice(1))[0];
    if (!id) {
      console.error('Usage: carina playbook inspect <id>');
      process.exit(1);
    }
    printInspect(id);
    return;
  }

  if (action === 'serve') {
    const id = positionalArgs(args.slice(1))[0];
    if (!id) {
      console.error('Usage: carina playbook serve <id> [--via backend] [--execute]');
      process.exit(1);
    }
    await printServe(id, parseVia(args), flag(args, '--execute'));
    return;
  }

  console.error(`Unknown playbook action: ${action}`);
  process.exit(1);
}

export async function runCookbookDefault(): Promise<void> {
  printDefaultOverview();
}

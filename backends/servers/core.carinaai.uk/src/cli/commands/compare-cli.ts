import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  defaultCompareProviders,
  formatCompareMarkdown,
  formatCompareTerminal,
  revealBlindCompare,
  runCompare,
} from '../../agents/compare.js';
import { loadLocalEnv } from '../config/env.js';

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0 || !args[idx + 1]) return undefined;
  return args[idx + 1];
}

function positionalPrompt(args: string[]): string {
  const skip = new Set<number>();
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith('--')) {
      skip.add(i);
      if (['--providers', '--save', '--max-tokens', '--format'].includes(args[i]!)) {
        skip.add(i + 1);
      }
    }
  }
  return args.filter((_, i) => !skip.has(i)).join(' ').trim();
}

export async function runCompareCommand(args: string[]): Promise<void> {
  loadLocalEnv();

  const prompt = positionalPrompt(args);
  if (!prompt) {
    console.error('Usage: carina compare "<prompt>" [--providers a,b] [--blind] [--save file.md] [--max-tokens N]');
    process.exit(1);
  }

  const providersRaw = flagValue(args, '--providers');
  const providers = providersRaw
    ? providersRaw.split(',').map((p) => p.trim()).filter(Boolean)
    : defaultCompareProviders();

  if (providers.length === 0) {
    console.error('No configured providers. Add API keys or enable a local backend.');
    process.exit(1);
  }

  const blind = flag(args, '--blind');
  const saveTo = flagValue(args, '--save');
  const maxTokens = Number(flagValue(args, '--max-tokens') ?? '800');
  const outputFormat = (flagValue(args, '--format') ?? 'terminal') as 'terminal' | 'markdown';

  try {
    const result = await runCompare({
      prompt,
      providers,
      blind,
      maxTokens: Number.isFinite(maxTokens) ? maxTokens : 800,
      outputFormat,
    });

    const body = outputFormat === 'markdown'
      ? formatCompareMarkdown(result, blind)
      : formatCompareTerminal(result, blind);

    if (saveTo) {
      await fs.writeFile(saveTo, `${body}\n`, 'utf8');
      console.log(`Saved compare output to ${saveTo}`);
      return;
    }

    console.log(body);

    if (blind && process.stdin.isTTY) {
      const rl = readline.createInterface({ input, output });
      await rl.question('\nPress Enter to reveal providers.');
      rl.close();
      console.log(revealBlindCompare(result));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Compare failed: ${msg}`);
    process.exit(1);
  }
}

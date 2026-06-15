import {
  renderReportHtml,
  renderReportMarkdown,
  runDeepResearch,
} from '../../agents/deep-research.js';
import { loadLocalEnv } from '../config/env.js';

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0 || !args[idx + 1]) return undefined;
  return args[idx + 1];
}

function positionalQuery(args: string[]): string {
  const skip = new Set<number>();
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith('--')) {
      skip.add(i);
      if (['--rounds', '--sources', '--save', '--format', '--provider'].includes(args[i]!)) {
        skip.add(i + 1);
      }
    }
  }
  return args.filter((_, i) => !skip.has(i)).join(' ').trim();
}

function progressSink(saveToFile: string | undefined): (line: string) => void {
  return (line: string) => {
    const stream = saveToFile ? process.stdout : process.stderr;
    stream.write(`${line}\n`);
  };
}

export async function runResearchCommand(args: string[]): Promise<void> {
  loadLocalEnv();

  const query = positionalQuery(args);
  if (!query) {
    console.error('Usage: carina research "<query>" [--rounds N] [--sources N] [--save file] [--format markdown|html] [--provider name]');
    process.exit(1);
  }

  const saveToFile = flagValue(args, '--save');
  const outputFormat = (flagValue(args, '--format') ?? 'markdown') as 'markdown' | 'html';
  const provider = flagValue(args, '--provider');
  const maxRounds = Number(flagValue(args, '--rounds') ?? '4');
  const maxSources = Number(flagValue(args, '--sources') ?? '12');

  try {
    const report = await runDeepResearch({
      query,
      maxRounds: Number.isFinite(maxRounds) ? maxRounds : 4,
      maxSources: Number.isFinite(maxSources) ? maxSources : 12,
      outputFormat,
      saveToFile,
      providerOverride: provider ? { name: provider } : undefined,
      onProgress: progressSink(saveToFile),
    });

    if (saveToFile) {
      console.log(`Report saved to ${saveToFile}`);
      return;
    }

    const output = outputFormat === 'html'
      ? renderReportHtml(report)
      : renderReportMarkdown(report);
    process.stdout.write(`${output}\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (saveToFile) {
      console.log(`Research failed: ${msg}`);
    } else {
      process.stderr.write(`Research failed: ${msg}\n`);
    }
    process.exit(1);
  }
}

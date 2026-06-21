import {
  getResearchReport,
  listResearchReports,
  updateResearchReport,
} from '../../research/research-store.js';
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
      if (['--rounds', '--sources', '--save', '--format', '--provider', '--title', '--file'].includes(args[i]!)) {
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

async function runResearchQuery(args: string[]): Promise<void> {
  const query = positionalQuery(args);
  if (!query) {
    console.error('Usage: carina research "<query>" [--rounds N] [--sources N] [--save file] [--format markdown|html] [--provider name] [--no-persist]');
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
      persist: !flag(args, '--no-persist'),
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

export async function runResearchCommand(args: string[]): Promise<void> {
  loadLocalEnv();

  const action = args[0];
  if (!action || action.startsWith('"') || action.startsWith("'") || !['list', 'show', 'edit', 'export'].includes(action)) {
    await runResearchQuery(args);
    return;
  }

  if (action === 'list') {
    const reports = await listResearchReports();
    if (reports.length === 0) {
      console.log('No saved research reports yet. Run: carina research "your topic"');
      return;
    }
    console.log('Saved research reports:\n');
    for (const row of reports) {
      console.log(`  ${row.id.slice(0, 8)}  ${row.createdAt}  sources=${row.sourceCount}  ${row.title}`);
      console.log(`    share: ${row.shareId}  path: ${row.markdownPath}`);
    }
    return;
  }

  if (action === 'show') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina research show <id-or-share-id>');
      process.exit(1);
    }
    const record = await getResearchReport(id);
    if (!record) {
      console.error(`Report not found: ${id}`);
      process.exit(1);
    }
    process.stdout.write(`${record.markdown}\n`);
    return;
  }

  if (action === 'export') {
    const id = args[1];
    const format = (flagValue(args, '--format') ?? 'markdown') as 'markdown' | 'html';
    if (!id) {
      console.error('Usage: carina research export <id> [--format markdown|html]');
      process.exit(1);
    }
    const record = await getResearchReport(id);
    if (!record) {
      console.error(`Report not found: ${id}`);
      process.exit(1);
    }
    const out = format === 'html' && record.html ? record.html : record.markdown;
    process.stdout.write(`${out}\n`);
    return;
  }

  if (action === 'edit') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina research edit <id> [--title text] [--file path]');
      process.exit(1);
    }
    const title = flagValue(args, '--title');
    const file = flagValue(args, '--file');
    let markdown: string | undefined;
    if (file) {
      const fs = await import('node:fs/promises');
      markdown = await fs.readFile(file, 'utf8');
    }
    const updated = await updateResearchReport(id, { title, markdown });
    if (!updated) {
      console.error(`Report not found: ${id}`);
      process.exit(1);
    }
    console.log(`Updated report ${updated.id} (${updated.title})`);
    console.log(`  markdown: ${updated.markdownPath}`);
    return;
  }

  console.error('Usage: carina research "<query>" | list | show <id> | edit <id> | export <id>');
  process.exit(1);
}

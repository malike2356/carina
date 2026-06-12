import fs from 'fs';
import path from 'path';
import { CARINA_DATA_DIR } from '../../config/paths.js';

function parseLinesArg(args: string[]): number {
  const idx = args.indexOf('--lines');
  if (idx >= 0) {
    const n = Number(args[idx + 1]);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 5000);
  }
  const match = args.find((a) => a.startsWith('--lines='));
  if (match) {
    const n = Number(match.split('=')[1]);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 5000);
  }
  return 50;
}

export async function runLogsCommand(action = 'tail', logName?: string, extraArgs: string[] = []): Promise<void> {
  const json = extraArgs.includes('--json') || action === 'list' && extraArgs.includes('--json');
  const lines = parseLinesArg(extraArgs);
  const logsDir = path.join(CARINA_DATA_DIR, 'logs');
  if (!fs.existsSync(logsDir)) {
    if (json) console.log(JSON.stringify({ files: [] }));
    else console.log('No logs directory yet.');
    return;
  }

  const files = fs.readdirSync(logsDir).filter((f) => f.endsWith('.log'));
  if (files.length === 0) {
    if (json) console.log(JSON.stringify({ files: [] }));
    else console.log('No log files.');
    return;
  }

  if (action === 'list') {
    const listed = files.map((f) => {
      const stat = fs.statSync(path.join(logsDir, f));
      return { name: f, bytes: stat.size, mtime: stat.mtime.toISOString() };
    });
    if (json) {
      console.log(JSON.stringify({ files: listed }, null, 2));
      return;
    }
    console.log('Log files:');
    for (const f of listed) {
      console.log(`  ${f.name}  (${f.bytes} bytes)`);
    }
    return;
  }

  const target = logName && files.includes(logName) ? logName : files[0]!;
  const filePath = path.join(logsDir, target);
  const content = fs.readFileSync(filePath, 'utf8');
  const tailLines = content.split('\n').slice(-lines);
  if (json) {
    console.log(JSON.stringify({ file: target, lines: tailLines }, null, 2));
    return;
  }
  console.log(`--- ${target} (last ${lines} lines) ---\n${tailLines.join('\n')}`);
}

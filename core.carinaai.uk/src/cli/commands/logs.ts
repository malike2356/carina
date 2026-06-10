import fs from 'fs';
import path from 'path';
import { CARINA_DATA_DIR } from '../../config/paths.js';

export async function runLogsCommand(action = 'tail', logName?: string): Promise<void> {
  const logsDir = path.join(CARINA_DATA_DIR, 'logs');
  if (!fs.existsSync(logsDir)) {
    console.log('No logs directory yet.');
    return;
  }

  const files = fs.readdirSync(logsDir).filter((f) => f.endsWith('.log'));
  if (files.length === 0) {
    console.log('No log files.');
    return;
  }

  if (action === 'list') {
    console.log('Log files:');
    for (const f of files) {
      const stat = fs.statSync(path.join(logsDir, f));
      console.log(`  ${f}  (${stat.size} bytes)`);
    }
    return;
  }

  const target = logName && files.includes(logName) ? logName : files[0];
  const filePath = path.join(logsDir, target);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const tail = lines.slice(-50).join('\n');
  console.log(`--- ${target} (last 50 lines) ---\n${tail}`);
}

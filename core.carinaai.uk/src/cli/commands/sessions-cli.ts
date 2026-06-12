import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { CARINA_HOME } from '../../config/paths.js';
import { initDb } from '../../memory/db.js';
import { browseRecentSessions } from '../../memory/session-index.js';

export async function runSessionsCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const json = args.includes('--json');

  if (action === 'list') {
    const localDir = path.join(CARINA_HOME, 'sessions');
    const local: Array<{ id: string; updatedAt: string; source: string }> = [];
    try {
      const files = await fs.readdir(localDir);
      for (const file of files.filter((f) => f.endsWith('.json'))) {
        const raw = await fs.readFile(path.join(localDir, file), 'utf-8');
        const parsed = JSON.parse(raw) as { id: string; updatedAt: string; source: string };
        local.push(parsed);
      }
    } catch {
      // no local sessions
    }

    let dbSessions: Awaited<ReturnType<typeof browseRecentSessions>> = [];
    try {
      await initDb();
      dbSessions = await browseRecentSessions(20);
    } catch {
      // postgres optional
    }

    console.log(chalk.bold('\nSessions\n'));
    if (json) {
      console.log(JSON.stringify({
        local: local.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        db: dbSessions,
      }, null, 2));
      return;
    }
    for (const s of local.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 15)) {
      console.log(`  ${s.id.slice(0, 8)}  local  ${s.source}  ${s.updatedAt}`);
    }
    for (const s of dbSessions) {
      console.log(`  ${s.sessionId.slice(0, 8)}  db     ${s.snippet.slice(0, 50)}`);
    }
    console.log('');
    return;
  }

  if (action === 'show') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina sessions show <id>');
      process.exit(1);
    }
    const file = path.join(CARINA_HOME, 'sessions', `${id}.json`);
    try {
      const raw = await fs.readFile(file, 'utf-8');
      console.log(raw);
    } catch {
      console.error(`Session not found: ${id}`);
      process.exit(1);
    }
    return;
  }

  if (action === 'delete') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina sessions delete <id>');
      process.exit(1);
    }
    await fs.rm(path.join(CARINA_HOME, 'sessions', `${id}.json`), { force: true });
    console.log(`Deleted session ${id}`);
    return;
  }

  console.error('Usage: carina sessions <list|show|delete> [id]');
  process.exit(1);
}

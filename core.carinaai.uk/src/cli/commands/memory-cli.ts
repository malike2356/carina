import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { initDb } from '../../memory/db.js';
import {
  describeMemoryBackends,
  getMemoryBackend,
  initMemoryBackend,
  setMemoryBackend,
} from '../../memory/backends/index.js';
import { listRecentMemories, searchMemory, clearSession } from '../../memory/store.js';
import { getAllPersistentContext, listPersistentFacts } from '../../memory/persistent-memory.js';
import {
  approvePromotion,
  isRemAvailable,
  listPromotionQueue,
  rejectPromotion,
  runRemPromotionCycle,
  syncDreamsFile,
} from '../../memory/rem/index.js';
import { reindexAllMemory } from '../../memory/rem/memory-reindex.js';
import { appendEnvValue } from '../config/loader.js';

async function initMemory(): Promise<void> {
  const backend = initMemoryBackend();
  const needsPostgres = backend.name === 'postgres'
    || (backend.name === 'builtin' && process.env.CARINA_SKIP_POSTGRES !== 'true' && process.env.CARINA_LOCAL_MODE !== 'true');
  if (needsPostgres) await initDb();
}

export async function runMemoryCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';

  if (action === 'backends') {
    initMemoryBackend();
    const rows = describeMemoryBackends();
    console.log(chalk.bold('\nMemory backends\n'));
    for (const row of rows) {
      const status = row.active
        ? chalk.green('* active')
        : row.configured
          ? chalk.gray('ready')
          : chalk.yellow('not configured');
      console.log(`  ${row.name.padEnd(10)} ${status}  ${row.displayName}`);
      console.log(chalk.gray(`             ${row.description}`));
      if (row.requiredEnv.length > 0) {
        console.log(chalk.gray(`             env: ${row.requiredEnv.join(', ')}`));
      }
    }
    console.log('\nSwitch: carina memory use <backend>\n');
    return;
  }

  if (action === 'use' || action === 'backend') {
    const name = args[1];
    if (!name) {
      const choice = await select({
        message: 'Memory backend',
        choices: describeMemoryBackends().map((b) => ({
          name: `${b.displayName} (${b.name})${b.configured ? '' : ' - needs config'}`,
          value: b.name,
        })),
      });
      setMemoryBackend(choice);
      await appendEnvValue('CARINA_MEMORY_BACKEND', choice);
      console.log(chalk.green(`Active backend: ${choice}`));
      return;
    }
    setMemoryBackend(name);
    await appendEnvValue('CARINA_MEMORY_BACKEND', name);
    console.log(chalk.green(`Active backend: ${name}`));
    return;
  }

  if (action === 'status') {
    initMemoryBackend();
    const backend = getMemoryBackend();
    console.log(`backend: ${backend.name} (${backend.displayName})`);
    console.log(`configured: ${backend.isConfigured() ? 'yes' : 'no'}`);
    return;
  }

  if (action === 'test') {
    initMemoryBackend();
    const backend = getMemoryBackend();
    if (!backend.isConfigured()) {
      console.error(`Backend not configured: ${backend.name}`);
      process.exit(1);
    }
    const sessionId = `cli-test-${Date.now()}`;
    await backend.saveMemory(sessionId, 'user', 'Carina memory backend test ping');
    const history = await backend.getSessionHistory(sessionId, 5);
    await backend.clearSession(sessionId);
    console.log(chalk.green(`ok: ${backend.name} wrote and read ${history.length} message(s)`));
    return;
  }

  try {
    await initMemory();
  } catch (err) {
    console.error('Memory store unavailable:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (action === 'list') {
    const limit = Number(args[1] ?? 20);
    const memories = await listRecentMemories(limit);
    console.log(chalk.bold(`\nRecent memories (${memories.length}) [${getMemoryBackend().name}]\n`));
    for (const m of memories) {
      console.log(`  ${m.id.slice(0, 8)}  ${(m.role ?? 'unknown').padEnd(8)}  ${m.content.slice(0, 70)}`);
    }
    console.log('');
    return;
  }

  if (action === 'search') {
    const query = args.slice(1).join(' ');
    if (!query) {
      console.error('Usage: carina memory search <query>');
      process.exit(1);
    }
    const hits = await searchMemory(query, 15);
    for (const m of hits) {
      console.log(`  ${m.id.slice(0, 8)}  ${m.content.slice(0, 80)}`);
    }
    return;
  }

  if (action === 'facts') {
    const facts = await listPersistentFacts('user');
    console.log(chalk.bold(`\nPersistent facts (${facts.length})\n`));
    for (const f of facts.slice(0, 30)) {
      console.log(`  - ${f.content}`);
    }
    const ctx = await getAllPersistentContext();
    if (ctx) console.log(chalk.gray(`\nInjected context: ${ctx.length} chars\n`));
    return;
  }

  if (action === 'clear') {
    const sessionId = args[1] ?? 'default-session';
    await clearSession(sessionId);
    console.log(`Cleared session: ${sessionId}`);
    return;
  }

  if (action === 'dreams') {
    if (!isRemAvailable()) {
      console.error('REM requires the PostgreSQL episodic memory backend.');
      process.exit(1);
    }
    const pending = await listPromotionQueue('pending');
    const path = await syncDreamsFile(pending);
    console.log(chalk.bold('\nREM review queue (DREAMS.md)\n'));
    console.log(`  File: ${path}`);
    console.log(`  Pending: ${pending.length}`);
    for (const row of pending.slice(0, 20)) {
      console.log(`  ${row.id.slice(0, 8)}  score=${row.score}  ${row.proposedTarget}  ${row.proposedContent.slice(0, 60)}`);
    }
    console.log('');
    return;
  }

  if (action === 'promote') {
    if (!isRemAvailable()) {
      console.error('REM requires the PostgreSQL episodic memory backend.');
      process.exit(1);
    }
    const sub = args[1] ?? 'list';
    if (sub === 'list') {
      const pending = await listPromotionQueue('pending');
      console.log(chalk.bold(`\nPending promotions (${pending.length})\n`));
      for (const row of pending) {
        console.log(`  ${row.id}  score=${row.score}  -> ${row.proposedTarget}`);
        console.log(chalk.gray(`    ${row.proposedContent.slice(0, 100)}`));
      }
      console.log('');
      return;
    }
    if (sub === 'run' || sub === 'scan') {
      const result = await runRemPromotionCycle();
      console.log(chalk.green(`REM cycle: scanned=${result.scanned} enqueued=${result.enqueued} auto=${result.autoPromoted}`));
      if (result.dreamsPath) console.log(`DREAMS.md: ${result.dreamsPath}`);
      return;
    }
    if (sub === 'approve') {
      const id = args[2];
      if (!id) {
        console.error('Usage: carina memory promote approve <queue-id>');
        process.exit(1);
      }
      const approved = await approvePromotion(id);
      console.log(chalk.green(`Approved promotion ${approved.id} -> ${approved.proposedTarget}`));
      return;
    }
    if (sub === 'reject') {
      const id = args[2];
      if (!id) {
        console.error('Usage: carina memory promote reject <queue-id>');
        process.exit(1);
      }
      await rejectPromotion(id);
      console.log(chalk.yellow(`Rejected promotion ${id}`));
      return;
    }
    console.error('Usage: carina memory promote <list|run|approve|reject> [id]');
    process.exit(1);
    return;
  }

  if (action === 'reindex') {
    const result = await reindexAllMemory({
      batchSize: Number(args[1] ?? 100),
      force: args.includes('--force'),
    });
    console.log(chalk.green(
      `Reindexed episodic=${result.episodicUpdated} skipped=${result.episodicSkipped} facts=${result.factsUpdated}`,
    ));
    return;
  }

  console.error('Usage: carina memory <list|search|facts|clear|dreams|promote|reindex|backends|use|status|test> [args]');
  process.exit(1);
}

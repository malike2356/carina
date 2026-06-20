import chalk from 'chalk';
import { initDb } from '../../memory/db.js';
import {
  addCard,
  claimCard,
  completeCard,
  heartbeatBoard,
  listClaimableCards,
  releaseCard,
  showBoard,
} from '../../agents/kanban-store.js';
import { bindOperatorProfile } from '../../ops/operator-profile.js';

function parseFlags(args: string[]): {
  profile?: string;
  boardId: string;
  assignee: string;
  rest: string[];
} {
  const rest: string[] = [];
  let profile: string | undefined;
  let boardId = 'default';
  let assignee = process.env.USER ?? 'operator';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--profile' && args[i + 1]) profile = args[++i];
    else if (arg === '--board' && args[i + 1]) boardId = args[++i]!;
    else if (arg === '--assignee' && args[i + 1]) assignee = args[++i]!;
    else rest.push(arg);
  }
  return { profile, boardId, assignee, rest };
}

export async function runKanbanCommand(args: string[]): Promise<void> {
  const { profile, boardId, assignee, rest } = parseFlags(args);
  const ctx = bindOperatorProfile(profile);
  await initDb();

  const action = rest[0] ?? 'status';
  const sessionId = ctx.sessionScope;

  if (action === 'status') {
    const beat = await heartbeatBoard(sessionId, boardId);
    const claimable = await listClaimableCards(sessionId, boardId);
    console.log(chalk.bold(`\nKanban (${ctx.profileName} / ${boardId})\n`));
    console.log(`  session: ${sessionId}`);
    console.log(`  total: ${beat.total}  in_progress: ${beat.in_progress}  blocked: ${beat.blocked}  done: ${beat.done}`);
    console.log(`  claimable: ${claimable.length}  stale in_progress: ${beat.stale.length}`);
    console.log('');
    return;
  }

  if (action === 'board' || action === 'show') {
    const grouped = await showBoard(sessionId, boardId);
    console.log(chalk.bold(`\nBoard ${boardId} (profile ${ctx.profileName})\n`));
    for (const [col, cards] of Object.entries(grouped)) {
      if (cards.length === 0) continue;
      console.log(chalk.cyan(`  ${col}:`));
      for (const c of cards) {
        const who = c.assignee ? ` @${c.assignee}` : '';
        console.log(`    ${c.id.slice(0, 8)}  ${c.title}${who}`);
      }
    }
    console.log('');
    return;
  }

  if (action === 'queue' || action === 'list') {
    const cards = await listClaimableCards(sessionId, boardId);
    console.log(chalk.bold(`\nClaimable queue (${cards.length})\n`));
    for (const c of cards) {
      console.log(`  ${c.id}  p${c.priority}  ${c.title}`);
    }
    console.log('');
    return;
  }

  if (action === 'add') {
    const title = rest[1];
    if (!title) {
      console.error('Usage: carina kanban add <title> [--profile NAME]');
      process.exit(1);
    }
    const card = await addCard({ sessionId, boardId, title });
    console.log(`Added ${card.id} to backlog`);
    return;
  }

  if (action === 'claim') {
    const cardId = rest[1];
    if (!cardId) {
      console.error('Usage: carina kanban claim <card-id> [--assignee NAME]');
      process.exit(1);
    }
    const result = await claimCard(cardId, assignee);
    if (result.error || !result.card) {
      console.error(result.error ?? 'claim failed');
      process.exit(1);
    }
    console.log(`Claimed ${result.card.id} by ${assignee} -> in_progress`);
    return;
  }

  if (action === 'release') {
    const cardId = rest[1];
    if (!cardId) {
      console.error('Usage: carina kanban release <card-id> [--assignee NAME]');
      process.exit(1);
    }
    const result = await releaseCard(cardId, assignee);
    if (result.error || !result.card) {
      console.error(result.error ?? 'release failed');
      process.exit(1);
    }
    console.log(`Released ${result.card.id} to backlog`);
    return;
  }

  if (action === 'complete' || action === 'done') {
    const cardId = rest[1];
    if (!cardId) {
      console.error('Usage: carina kanban complete <card-id>');
      process.exit(1);
    }
    const card = await completeCard(cardId);
    if (!card) {
      console.error('Card not found');
      process.exit(1);
    }
    console.log(`Completed ${card.id}`);
    return;
  }

  console.error('Usage: carina kanban <status|board|queue|add|claim|release|complete> ...');
  process.exit(1);
}

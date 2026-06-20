import chalk from 'chalk';
import {
  commitmentsStorePath,
  dismissCommitments,
  listCommitments,
} from '../../commitments/index.js';
import type { CommitmentStatus } from '../../commitments/types.js';

function parseStatus(value: string | undefined): CommitmentStatus | 'all' | undefined {
  if (!value) return undefined;
  const allowed: Array<CommitmentStatus | 'all'> = [
    'pending', 'sent', 'dismissed', 'snoozed', 'expired', 'all',
  ];
  return allowed.includes(value as CommitmentStatus | 'all')
    ? (value as CommitmentStatus | 'all')
    : undefined;
}

export async function runCommitmentsCommand(args: string[]): Promise<void> {
  const json = args.includes('--json');
  const filtered = args.filter((a) => a !== '--json');
  const action = filtered[0] ?? 'list';

  let agentId: string | undefined;
  let status: CommitmentStatus | 'all' | undefined;
  const all = args.includes('--all');

  for (let i = 0; i < filtered.length; i += 1) {
    if (filtered[i] === '--agent' && filtered[i + 1]) {
      agentId = filtered[i + 1];
      i += 1;
    }
    if (filtered[i] === '--status' && filtered[i + 1]) {
      status = parseStatus(filtered[i + 1]);
      i += 1;
    }
  }

  if (action === 'dismiss') {
    const ids = filtered.slice(1).filter((id) => !id.startsWith('--'));
    if (ids.length === 0) {
      console.error('Usage: carina commitments dismiss <id...>');
      process.exit(1);
    }
    const count = dismissCommitments(ids);
    if (json) {
      console.log(JSON.stringify({ ok: true, dismissed: count, ids }, null, 2));
      return;
    }
    console.log(count > 0
      ? chalk.green(`Dismissed ${count} commitment(s)`)
      : chalk.yellow('No matching commitments found'));
    return;
  }

  if (action !== 'list' && action !== 'status') {
    console.error('Usage: carina commitments [list] [--all] [--agent <id>] [--status <status>] [--json]');
    console.error('       carina commitments dismiss <id...> [--json]');
    process.exit(1);
  }

  const rows = listCommitments({
    agentId,
    status: status ?? (all ? 'all' : 'pending'),
  });

  if (json) {
    console.log(JSON.stringify({
      store: commitmentsStorePath(),
      count: rows.length,
      commitments: rows,
    }, null, 2));
    return;
  }

  console.log(chalk.bold('\nInferred commitments\n'));
  if (rows.length === 0) {
    console.log('  none');
    console.log('');
    return;
  }

  for (const row of rows) {
    console.log(`  ${row.id}  ${row.status}  ${row.kind}`);
    console.log(`    due ${row.dueAt}  agent=${row.agentId}  session=${row.sessionId.slice(0, 24)}`);
    console.log(`    ${row.checkInText}`);
    console.log(`    source: ${row.sourceSummary}`);
  }
  console.log('');
}

import chalk from 'chalk';
import {
  countTurnBuckets,
  parseSinceArg,
  readTurnLogs,
  turnLogPath,
  type TurnBucket,
} from '../../telemetry/turn-log.js';

function parseTurnsArgs(args: string[]): {
  since?: Date;
  bucket?: TurnBucket;
  limit: number;
  json: boolean;
} {
  let since: Date | undefined;
  let bucket: TurnBucket | undefined;
  let limit = 50;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--since' && args[i + 1]) {
      since = parseSinceArg(args[++i]!);
    } else if (arg === '--bucket' && args[i + 1]) {
      bucket = args[++i] as TurnBucket;
    } else if (arg === '--limit' && args[i + 1]) {
      limit = Math.max(1, Number(args[++i]!) || 50);
    } else if (arg === '--json') {
      json = true;
    }
  }

  return { since, bucket, limit, json };
}

export async function runTurnsOps(args: string[]): Promise<void> {
  const { since, bucket, limit, json } = parseTurnsArgs(args);
  const entries = await readTurnLogs({ since, bucket, limit });

  if (json) {
    console.log(JSON.stringify({
      path: turnLogPath(),
      count: entries.length,
      buckets: countTurnBuckets(entries),
      entries,
    }, null, 2));
    return;
  }

  console.log(chalk.bold(`\nTurn log: ${turnLogPath()}\n`));
  if (entries.length === 0) {
    console.log(chalk.gray('No turns logged yet.'));
    return;
  }

  const buckets = countTurnBuckets(entries);
  console.log(chalk.gray(
    `Showing ${entries.length} turn(s)`
    + `${since ? ` since ${since.toISOString()}` : ''}`
    + `${bucket ? ` bucket=${bucket}` : ''}`,
  ));
  console.log(chalk.gray(
    `Buckets: ok=${buckets.ok} slow=${buckets.slow} tool_error=${buckets.tool_error}`
    + ` injection=${buckets.injection} verbose=${buckets.verbose}\n`,
  ));

  for (const e of entries) {
    const tools = e.toolsUsed.length > 0 ? e.toolsUsed.join(',') : '-';
    console.log(
      `${e.ts.slice(0, 19)}  ${e.bucket.padEnd(10)}  ${String(e.latencyMs).padStart(5)}ms`
      + `  ${e.path.padEnd(6)}  ${e.provider}/${e.model}`
      + `  tools=${tools}`,
    );
  }
  console.log('');
}

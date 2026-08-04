import {
  listAivaLearning,
  runAivaDailyLearningReview,
} from '../../memory/aiva/learning-loop.js';

function argValue(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function isJson(args: string[]): boolean {
  return args.includes('--json');
}

export async function runAivaLearningCommand(args: string[]): Promise<void> {
  const action = args.find((arg) => !arg.startsWith('--')) ?? 'review';
  const workspaceId = argValue(args, '--workspace');
  const workerId = argValue(args, '--worker');

  if (action === 'review' || action === 'review-all') {
    const result = await runAivaDailyLearningReview({
      workspaceId,
      workerId,
      limit: Number(argValue(args, '--limit') ?? 200),
    });
    if (isJson(args)) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log('Aiva learning review');
    console.log(`  Scanned:    ${result.scanned}`);
    console.log(`  Candidates: ${result.candidates}`);
    console.log(`  Auto-saved: ${result.autoSaved}`);
    console.log(`  Pending:    ${result.pending}`);
    console.log(`  Skipped:    ${result.skipped}`);
    return;
  }

  if (action === 'list') {
    if (!workspaceId || !workerId) {
      console.error('Usage: carina aiva-learning list --workspace <id> --worker <id> [--json]');
      process.exitCode = 1;
      return;
    }
    const status = argValue(args, '--status') ?? 'all';
    const data = await listAivaLearning({
      workspaceId,
      workerId,
      status: ['pending', 'approved', 'removed', 'auto_saved'].includes(status)
        ? status as 'pending' | 'approved' | 'removed' | 'auto_saved'
        : 'all',
    });
    if (isJson(args)) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    console.log(`Aiva learned items (${data.items.length})`);
    for (const item of data.items) {
      console.log(`  ${item.status} ${item.kind} ${item.confidence.toFixed(2)} ${item.content}`);
    }
    console.log(`User memory: ${data.budgets.user.used}/${data.budgets.user.max}`);
    console.log(`Agent notes: ${data.budgets.memory.used}/${data.budgets.memory.max}`);
    return;
  }

  console.error('Usage: carina aiva-learning <review|review-all|list> [--workspace <id>] [--worker <id>] [--json]');
  process.exitCode = 1;
}

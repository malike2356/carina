import { bindOperatorProfile } from '../../ops/operator-profile.js';
import { checkpointManagerTool } from '../../tools/checkpoint-manager.js';
import { latestCheckpoint } from '../../tools/checkpoint-store.js';

function parseProfileFlag(args: string[]): { profile?: string; rest: string[] } {
  const rest: string[] = [];
  let profile: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) {
      profile = args[++i];
    } else {
      rest.push(args[i]!);
    }
  }
  return { profile, rest };
}

export async function runCheckpointCommand(args: string[]): Promise<void> {
  const { profile, rest } = parseProfileFlag(args);
  bindOperatorProfile(profile);

  const action = rest[0] ?? 'list';

  if (action === 'list') {
    const result = await checkpointManagerTool.execute({ action: 'list' }) as Record<string, unknown>;
    const checkpoints = (result.checkpoints ?? []) as Array<Record<string, unknown>>;
    if (checkpoints.length === 0) {
      console.log('No checkpoints.');
      return;
    }
    for (const c of checkpoints) {
      console.log(`  ${String(c.checkpoint_id).slice(0, 8)}  ${c.label ?? ''}  ${c.created_at ?? ''}`);
    }
    return;
  }

  if (action === 'create') {
    const paths = rest.slice(1);
    if (paths.length === 0) {
      console.error('Usage: carina checkpoint create <path> [path...] [--profile <name>]');
      process.exit(1);
    }
    const result = await checkpointManagerTool.execute({ action: 'create', paths }) as Record<string, unknown>;
    if (result.error) {
      console.error(String(result.error));
      process.exit(1);
    }
    console.log(`Created checkpoint: ${result.checkpoint_id}`);
    return;
  }

  if (action === 'restore') {
    const id = rest[1];
    if (!id) {
      console.error('Usage: carina checkpoint restore <id> [--profile <name>]');
      process.exit(1);
    }
    const result = await checkpointManagerTool.execute({ action: 'restore', checkpoint_id: id }) as Record<string, unknown>;
    if (result.error) {
      console.error(String(result.error));
      process.exit(1);
    }
    console.log('Restored:', (result.restored as string[] | undefined)?.join(', ') ?? id);
    return;
  }

  if (action === 'restore-latest') {
    const latest = await latestCheckpoint();
    if (!latest) {
      console.log('No checkpoints to restore.');
      return;
    }
    const result = await checkpointManagerTool.execute({
      action: 'restore',
      checkpoint_id: latest.checkpoint_id,
    }) as Record<string, unknown>;
    if (result.error) {
      console.error(String(result.error));
      process.exit(1);
    }
    console.log(`Restored latest (${latest.checkpoint_id.slice(0, 8)}):`,
      (result.restored as string[] | undefined)?.join(', ') ?? latest.checkpoint_id);
    return;
  }

  if (action === 'delete') {
    const id = rest[1];
    if (!id) {
      console.error('Usage: carina checkpoint delete <id> [--profile <name>]');
      process.exit(1);
    }
    await checkpointManagerTool.execute({ action: 'delete', checkpoint_id: id });
    console.log(`Deleted checkpoint ${id}`);
    return;
  }

  console.error('Usage: carina checkpoint <list|create|restore|restore-latest|delete> [args] [--profile <name>]');
  process.exit(1);
}

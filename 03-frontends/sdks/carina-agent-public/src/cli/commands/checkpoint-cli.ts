import { checkpointManagerTool } from '../../tools/checkpoint-manager.js';

export async function runCheckpointCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';

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
    const paths = args.slice(1);
    if (paths.length === 0) {
      console.error('Usage: carina checkpoint create <path> [path...]');
      process.exit(1);
    }
    const result = await checkpointManagerTool.execute({ action: 'create', paths }) as Record<string, unknown>;
    console.log(`Created checkpoint: ${result.checkpoint_id}`);
    return;
  }

  if (action === 'restore') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina checkpoint restore <id>');
      process.exit(1);
    }
    const result = await checkpointManagerTool.execute({ action: 'restore', checkpoint_id: id }) as Record<string, unknown>;
    console.log('Restored:', (result.restored as string[] | undefined)?.join(', ') ?? id);
    return;
  }

  if (action === 'delete') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina checkpoint delete <id>');
      process.exit(1);
    }
    await checkpointManagerTool.execute({ action: 'delete', checkpoint_id: id });
    console.log(`Deleted checkpoint ${id}`);
    return;
  }

  console.error('Usage: carina checkpoint <list|create|restore|delete> [args]');
  process.exit(1);
}

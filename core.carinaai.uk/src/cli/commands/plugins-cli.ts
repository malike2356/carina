/**
 * Plugin commands are an alias for the extension bundle system.
 * Use `carina extensions` for the full command surface.
 */
import { runExtensionsCommand } from './extensions-cli.js';

const ACTION_MAP: Record<string, string> = {
  list: 'list',
  install: 'install',
  enable: 'enable',
  disable: 'disable',
  remove: 'remove',
  rollback: 'rollback',
  validate: 'validate',
  status: 'status',
};

export async function runPluginsCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const mapped = ACTION_MAP[action];
  if (!mapped) {
    console.error(
      'Usage: carina plugins <list|install|enable|disable|remove|rollback|validate|status> [args]',
    );
    console.error('Plugins are extension bundles. See: carina extensions help');
    process.exit(1);
  }
  await runExtensionsCommand([mapped, ...args.slice(1)]);
}

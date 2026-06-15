import { runPackInstall } from './install.js';
import { runPackList } from './list.js';
import { runPackPublish } from './publish.js';
import { runPackSearch } from './search.js';

function printPackHelp(): void {
  console.log(`Usage: carina pack <command> [args]

Domain pack commands (Skills Hub).

Commands:
  search <query>     Search hub registry (--json)
  list               List locally installed packs (--json)
  install <slug>     Install or upgrade a pack (--bypass-eval, --npm)
  publish <path>     Validate and publish a pack directory (--featured)

Environment:
  HUB_URL / SKILLS_HUB_URL     Hub base URL (default from config)
  CARINA_HUB_TOKEN             Publish API key for remote hub

Examples:
  carina pack search property
  carina pack install property-uk
  carina pack install property-uk --npm
  carina pack publish ./my-healthcare-pack
`);
}

export async function runPackCommand(args: string[]): Promise<void> {
  const action = args[0];
  const rest = args.slice(1);

  if (!action || action === '--help' || action === '-h' || action === 'help') {
    printPackHelp();
    return;
  }

  if (action === 'search') {
    await runPackSearch(rest);
    return;
  }
  if (action === 'list') {
    await runPackList(rest);
    return;
  }
  if (action === 'install') {
    await runPackInstall(rest);
    return;
  }
  if (action === 'publish') {
    await runPackPublish(rest);
    return;
  }

  console.error(`Unknown pack command: ${action}`);
  printPackHelp();
  process.exit(1);
}

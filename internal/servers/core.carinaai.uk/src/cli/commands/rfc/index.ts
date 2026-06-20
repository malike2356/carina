import { runRfcList } from './list.js';
import { runRfcPropose } from './propose.js';
import { config } from '../../../config/index.js';

function printRfcHelp(): void {
  console.log(`Usage: carina rfc <command> [args]

Request for Comments (RFC) workflow for kernel API and manifest changes.

Commands:
  propose "<title>"   Create docs/rfc/NNNN-slug.md from template
  list                List RFC files and status (--json)

Examples:
  carina rfc propose "Add legal-uk pack manifest v2 fields"
  carina rfc list
  carina rfc list --json

Docs: ${config.product.docsUrl}/developer/rfc-process
`);
}

export async function runRfcCommand(args: string[]): Promise<void> {
  const action = args[0];
  const rest = args.slice(1);

  if (!action || action === '--help' || action === '-h' || action === 'help') {
    printRfcHelp();
    return;
  }

  if (action === 'propose') {
    await runRfcPropose(rest);
    return;
  }
  if (action === 'list') {
    await runRfcList(rest);
    return;
  }

  console.error(`Unknown rfc command: ${action}`);
  printRfcHelp();
  process.exit(1);
}

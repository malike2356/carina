import chalk from 'chalk';
import { loadAllContacts } from '../../profiles/contacts.js';

export async function runContactsCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const query = args.slice(1).join(' ');

  if (action === 'list') {
    const contacts = await loadAllContacts();
    console.log(chalk.bold(`\nContacts (${contacts.length})\n`));
    for (const c of contacts) {
      console.log(`  ${c.id.slice(0, 8)}  ${c.name.padEnd(20)}  ${c.role ?? ''}  ${c.email ?? c.phone ?? ''}`);
    }
    console.log('');
    return;
  }

  if (action === 'show') {
    if (!query) {
      console.error('Usage: carina contacts show <id-or-name>');
      process.exit(1);
    }
    const contacts = await loadAllContacts();
    const hit = contacts.find((c) => c.id.startsWith(query) || c.name.toLowerCase().includes(query.toLowerCase()));
    if (!hit) {
      console.error('Contact not found');
      process.exit(1);
    }
    console.log(JSON.stringify(hit, null, 2));
    return;
  }

  console.error('Usage: carina contacts <list|show> [query]');
  process.exit(1);
}

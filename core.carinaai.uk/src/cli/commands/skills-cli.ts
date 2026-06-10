import chalk from 'chalk';
import { listCuratedSkills } from '../../skills/curator.js';
import { initDb } from '../../memory/db.js';

export async function runSkillsCommand(action = 'list'): Promise<void> {
  await initDb();

  if (action === 'list') {
    const active = await listCuratedSkills('active');
    const archived = await listCuratedSkills('archived');
    console.log(chalk.bold(`\nSkills: ${active.length} active, ${archived.length} archived\n`));
    for (const s of active.slice(0, 30)) {
      console.log(`  ${s.name.padEnd(28)} uses=${s.usageCount}  ${s.description.slice(0, 50)}`);
    }
    if (active.length > 30) console.log(`  ... and ${active.length - 30} more`);
    console.log('');
    return;
  }

  console.error('Usage: carina skills list');
  process.exit(1);
}

import chalk from 'chalk';
import { spawn } from 'child_process';
import { loadProfilePersonality } from '../../profiles/personality.js';
import { getActiveProfileName } from '../../profiles/manager.js';
import { describeProfile } from '../../profiles/manager.js';

export async function runPersonalityCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'show';
  const profileName = args[1] ?? getActiveProfileName() ?? 'default';

  if (action === 'show' || action === 'list') {
    const personality = await loadProfilePersonality(profileName);
    console.log(chalk.bold(`\nPersonality (${profileName})\n`));
    console.log(`  name:   ${personality.name}`);
    console.log(`  tone:   ${personality.tone}`);
    console.log(`  traits: ${personality.traits.join(', ')}`);
    console.log(`  source: ${personality.source}`);
    if (action === 'show') {
      console.log(`\n${personality.instructions.slice(0, 500)}`);
    }
    console.log('');
    return;
  }

  if (action === 'edit') {
    const profile = describeProfile(profileName);
    const editor = process.env.EDITOR ?? 'nano';
    const target = `${profile.dir}/personality.md`;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(editor, [target], { stdio: 'inherit' });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`editor exited ${code}`))));
      child.on('error', reject);
    });
    return;
  }

  console.error('Usage: carina personality <show|list|edit> [profile]');
  process.exit(1);
}

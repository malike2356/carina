import {
  activateProfile,
  createProfile,
  describeProfile,
  getActiveProfileName,
  listProfiles,
} from '../../profiles/manager.js';
import fs from 'fs/promises';

export async function runProfileCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const name = args[1];

  if (action === 'list') {
    const profiles = await listProfiles();
    const active = getActiveProfileName();
    if (profiles.length === 0) {
      console.log('No profiles. Create one: carina profile create <name>');
      return;
    }
    for (const p of profiles) {
      console.log(active === p ? `* ${p}` : `  ${p}`);
    }
    return;
  }

  if (action === 'create') {
    if (!name) {
      console.error('Usage: carina profile create <name>');
      process.exit(1);
    }
    const profile = await createProfile(name);
    console.log(`Profile created: ${profile.name}`);
    console.log(`  dir: ${profile.dir}`);
    return;
  }

  if (action === 'use') {
    if (!name) {
      console.error('Usage: carina profile use <name>');
      process.exit(1);
    }
    const profile = activateProfile(name);
    console.log(`Active profile: ${profile.name}`);
    console.log(`  CARINA_HOME=${profile.dir}`);
    return;
  }

  if (action === 'show') {
    if (!name) {
      console.error('Usage: carina profile show <name>');
      process.exit(1);
    }
    const profile = describeProfile(name);
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  if (action === 'delete') {
    if (!name) {
      console.error('Usage: carina profile delete <name>');
      process.exit(1);
    }
    const profile = describeProfile(name);
    await fs.rm(profile.dir, { recursive: true, force: true });
    console.log(`Deleted profile: ${name}`);
    return;
  }

  console.error('Usage: carina profile <list|create|use|show|delete> [name]');
  process.exit(1);
}

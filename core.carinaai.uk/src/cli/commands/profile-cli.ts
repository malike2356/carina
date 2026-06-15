import {
  activateProfile,
  cloneProfile,
  createProfile,
  describeProfile,
  exportProfile,
  getActiveProfileName,
  importProfile,
  listProfiles,
} from '../../profiles/manager.js';
import {
  describeNamedProfileScope,
  formatProfileScopeBanner,
} from '../../profiles/scope.js';
import {
  peekPreviousProfile,
  switchProfile,
  switchProfileBack,
} from '../../profiles/isolation.js';
import fs from 'fs/promises';

export async function runProfileCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const name = args[1];
  const extra = args[2];

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
    const profile = switchProfile(name);
    console.log(formatProfileScopeBanner(profile.name));
    return;
  }

  if (action === 'current') {
    const active = getActiveProfileName() ?? 'default';
    try {
      const scope = describeNamedProfileScope(active, getActiveProfileName());
      console.log(formatProfileScopeBanner(active));
      console.log(JSON.stringify(scope, null, 2));
    } catch {
      console.log(`Active profile: ${active}`);
    }
    const prev = peekPreviousProfile();
    if (prev) console.log(`Previous profile (carina profile back): ${prev}`);
    return;
  }

  if (action === 'back') {
    const profile = switchProfileBack();
    if (!profile) {
      console.error('No previous profile on the switch stack.');
      process.exit(1);
    }
    console.log(formatProfileScopeBanner(profile.name));
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

  if (action === 'scope') {
    const target = name ?? getActiveProfileName() ?? 'default';
    try {
      const scope = describeNamedProfileScope(target, getActiveProfileName());
      console.log(JSON.stringify(scope, null, 2));
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  if (action === 'clone') {
    if (!name || !extra) {
      console.error('Usage: carina profile clone <source> <target>');
      process.exit(1);
    }
    const profile = await cloneProfile(name, extra);
    console.log(`Cloned ${name} -> ${profile.name}`);
    console.log(`  dir: ${profile.dir}`);
    return;
  }

  if (action === 'export') {
    if (!name || !extra) {
      console.error('Usage: carina profile export <name> <dest-dir>');
      process.exit(1);
    }
    const dest = await exportProfile(name, extra);
    console.log(`Exported ${name} to ${dest}`);
    return;
  }

  if (action === 'import') {
    if (!name) {
      console.error('Usage: carina profile import <src-dir> [name]');
      process.exit(1);
    }
    const profile = await importProfile(name, extra);
    console.log(`Imported profile: ${profile.name}`);
    console.log(`  dir: ${profile.dir}`);
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

  console.error('Usage: carina profile <list|create|use|current|back|show|scope|clone|export|import|delete> [args]');
  process.exit(1);
}

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const requirements = [
  {
    file: 'src/components/aiva/AivaWorkerDirectChat.tsx',
    markers: [
      'direct-conversations',
      'Could not load conversations',
      'Start new chat',
      'New chat',
      'conversationAddon',
    ],
  },
  {
    file: 'src/components/shell/WorkspaceAccountMenu.tsx',
    markers: [
      "window.location.assign(destination)",
      "navigate('/settings?section=account')",
      "navigate('/billing/aiva')",
      'Log in with another account',
    ],
  },
  {
    file: 'src/lib/server-theme.ts',
    markers: ["const AIVA_DEFAULT_THEME = 'amber-minimal'"],
  },
];

const failures = [];
for (const requirement of requirements) {
  const path = join(root, requirement.file);
  let source = '';
  try {
    source = await readFile(path, 'utf8');
  } catch {
    failures.push(`${requirement.file}: file is missing`);
    continue;
  }
  for (const marker of requirement.markers) {
    if (!source.includes(marker)) {
      failures.push(`${requirement.file}: missing release marker ${JSON.stringify(marker)}`);
    }
  }
}

if (failures.length > 0) {
  console.error('UI release contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('UI release contract: passed');

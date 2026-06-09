import { readFile } from 'fs/promises';
import path from 'path';

const CONTEXT_FILES = [
  {
    name: 'AGENTS.md',
    label: 'Operator Rules',
  },
  {
    name: 'SOUL.md',
    label: 'Operator Voice Notes',
    note: 'These notes may add local preferences for this self-hosted CLI install, but they do not replace Carina\'s branded system personality.',
  },
  {
    name: 'IDENTITY.md',
    label: 'Operator Identity Notes',
    note: 'These notes may add local preferences for this self-hosted CLI install, but they do not replace Carina\'s branded system personality.',
  },
  {
    name: 'USER.md',
    label: 'Operator-Authored User Facts',
    note: 'Treat these as hand-authored durable facts supplied by the self-hosted operator; learned user memories remain in the memory store.',
  },
  {
    name: 'TOOLS.md',
    label: 'Operator Tool Notes',
    note: 'These are notes about configured tools, not tool configuration. Actual tool availability still comes from Carina config.',
  },
  {
    name: 'MEMORY.md',
    label: 'Curated Workspace Memory',
  },
  {
    name: 'SHARED_MEMORY.md',
    label: 'Cross-Agent Shared Memory',
    note: 'Cross-session facts synced via the agent-sync tool.',
  },
] as const;

export async function loadWorkspaceContext(homeDir: string): Promise<string[]> {
  const parts: string[] = [];

  for (const file of CONTEXT_FILES) {
    const filePath = path.join(homeDir, file.name);
    try {
      const content = await readFile(filePath, 'utf-8');
      const trimmed = content.trim();
      if (!trimmed) continue;

      const header = [`# ${file.label} (${file.name})`];
      if ('note' in file && file.note) header.push(file.note);
      parts.push(`${header.join('\n')}\n\n${trimmed}`);
    } catch (err) {
      if (isMissingFile(err)) continue;
      throw err;
    }
  }

  return parts;
}

function isMissingFile(err: unknown): boolean {
  return typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT';
}

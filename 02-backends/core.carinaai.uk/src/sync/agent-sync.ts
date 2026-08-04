import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

export interface AgentSyncEntry {
  agent: string;
  updated_at: string;
  summary: string;
  facts: string[];
  session_id?: string;
}

export interface AgentSyncFile {
  version: number;
  agents: Record<string, AgentSyncEntry>;
}

function syncDir(): string {
  return process.env.CARINA_SYNC_DIR
    ?? process.env.CARINA_HOME
    ?? path.join(os.homedir(), '.carina');
}

export function sharedMemoryPath(): string {
  return path.join(syncDir(), 'SHARED_MEMORY.md');
}

export function agentSyncPath(): string {
  return path.join(syncDir(), 'agent-sync.json');
}

export async function readSharedMemory(): Promise<string> {
  try {
    return (await fs.readFile(sharedMemoryPath(), 'utf8')).trim();
  } catch {
    return '';
  }
}

export async function appendSharedMemory(section: string, content: string): Promise<void> {
  const dir = syncDir();
  await fs.mkdir(dir, { recursive: true });
  const header = `\n\n## ${section} (${new Date().toISOString()})\n`;
  const existing = fsSync.existsSync(sharedMemoryPath())
    ? await fs.readFile(sharedMemoryPath(), 'utf8')
    : '# Shared Memory\n\nCross-session facts synced between Carina profiles and IDE sessions.\n';
  await fs.writeFile(sharedMemoryPath(), `${existing.trim()}${header}\n${content.trim()}\n`, 'utf8');
}

export async function readAgentSync(): Promise<AgentSyncFile> {
  try {
    const raw = await fs.readFile(agentSyncPath(), 'utf8');
    const parsed = JSON.parse(raw) as AgentSyncFile;
    return { version: parsed.version ?? 1, agents: parsed.agents ?? {} };
  } catch {
    return { version: 1, agents: {} };
  }
}

export async function writeAgentSync(data: AgentSyncFile): Promise<void> {
  const dir = syncDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(agentSyncPath(), JSON.stringify(data, null, 2), 'utf8');
}

export async function updateAgentSync(
  agentName: string,
  update: Partial<AgentSyncEntry>,
): Promise<AgentSyncFile> {
  const current = await readAgentSync();
  const existing = current.agents[agentName] ?? {
    agent: agentName,
    updated_at: new Date().toISOString(),
    summary: '',
    facts: [],
  };
  current.agents[agentName] = {
    ...existing,
    ...update,
    agent: agentName,
    updated_at: new Date().toISOString(),
  };
  await writeAgentSync(current);
  return current;
}

export async function loadCrossAgentContext(): Promise<string[]> {
  const parts: string[] = [];
  const shared = await readSharedMemory();
  if (shared) parts.push(`Shared memory (SHARED_MEMORY.md):\n${shared}`);

  const sync = await readAgentSync();
  const agentLines = Object.values(sync.agents)
    .filter((a) => a.summary || a.facts.length > 0)
    .map((a) => {
      const facts = a.facts.length ? `\nFacts: ${a.facts.join('; ')}` : '';
      return `- ${a.agent} (${a.updated_at}): ${a.summary}${facts}`;
    });
  if (agentLines.length > 0) {
    parts.push(`Agent sync (agent-sync.json):\n${agentLines.join('\n')}`);
  }

  return parts;
}

function importSourceDir(envKey: string): string | null {
  const configured = process.env[envKey]?.trim();
  return configured || null;
}

export async function importWorkspaceFiles(
  sourceDir?: string,
  options: { overwrite?: boolean } = {},
): Promise<{ imported: string[]; updated: string[]; skipped: string[] }> {
  const srcRoot = sourceDir ?? importSourceDir('CARINA_IMPORT_WORKSPACE_FROM');
  if (!srcRoot) return { imported: [], updated: [], skipped: [] };

  const carinaHome = syncDir();
  const files = ['AGENTS.md', 'SOUL.md', 'IDENTITY.md', 'USER.md', 'MEMORY.md', 'SHARED_MEMORY.md'];
  const imported: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  await fs.mkdir(carinaHome, { recursive: true });
  for (const file of files) {
    const src = path.join(srcRoot, file);
    const dest = path.join(carinaHome, file);
    try {
      const content = await fs.readFile(src, 'utf8');
      if (!fsSync.existsSync(dest)) {
        await fs.writeFile(dest, content, 'utf8');
        imported.push(file);
      } else if (options.overwrite) {
        await fs.writeFile(dest, content, 'utf8');
        updated.push(file);
      } else {
        skipped.push(file);
      }
    } catch {
      // skip missing
    }
  }

  const syncSrc = path.join(srcRoot, 'agent-sync.json');
  const syncDest = agentSyncPath();
  try {
    if (!fsSync.existsSync(syncDest)) {
      await fs.copyFile(syncSrc, syncDest);
      imported.push('agent-sync.json');
    } else if (options.overwrite) {
      await fs.copyFile(syncSrc, syncDest);
      updated.push('agent-sync.json');
    } else {
      skipped.push('agent-sync.json');
    }
  } catch {
    // optional
  }

  return { imported, updated, skipped };
}

export async function importInboundMedia(sourceDir?: string): Promise<{ imported: string[]; skipped: number }> {
  const srcDir = sourceDir ?? importSourceDir('CARINA_IMPORT_MEDIA_FROM');
  if (!srcDir || !fsSync.existsSync(srcDir)) {
    return { imported: [], skipped: 0 };
  }

  const destDir = path.join(syncDir(), 'media', 'inbound');
  const imported: string[] = [];
  let skipped = 0;

  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (fsSync.existsSync(dest)) {
      skipped++;
      continue;
    }
    await fs.copyFile(src, dest);
    imported.push(entry.name);
  }

  return { imported, skipped };
}

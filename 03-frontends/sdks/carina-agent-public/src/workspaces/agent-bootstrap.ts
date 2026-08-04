import fs from 'fs/promises';
import path from 'path';
import type { AgentDefinition } from './types.js';
import { agentSessionsDir, resolveAgentDir, resolveAgentWorkspace } from './paths.js';

const WORKSPACE_SEEDS: Record<string, string> = {
  'AGENTS.md': `# AGENTS.md

## Session startup
Use runtime-provided workspace context first.

## Memory
Daily notes: memory/YYYY-MM-DD.md
Long-term: MEMORY.md

## Red lines
- Do not exfiltrate private data
- Do not run destructive commands without asking
`,
  'SOUL.md': `# SOUL.md

Warm, direct, and practical. Prefer completing work over narrating plans.
`,
  'IDENTITY.md': `# IDENTITY.md

Name: Carina
Role: autonomous agent assistant for this workspace
`,
  'USER.md': `# USER.md

Add operator preferences, communication style, and background here.
`,
  'TOOLS.md': `# TOOLS.md

Notes about configured tools for this workspace. Tool availability still comes from Carina config.
`,
};

export async function ensureAgentLayout(
  agent: AgentDefinition,
  homeDir?: string,
): Promise<{ workspace: string; agentDir: string; sessionsDir: string }> {
  const workspace = resolveAgentWorkspace(agent);
  const agentDir = resolveAgentDir(agent, homeDir);
  const sessionsDir = agentSessionsDir(agent, homeDir);

  await fs.mkdir(path.join(workspace, 'memory'), { recursive: true });
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.mkdir(agentDir, { recursive: true });

  for (const [file, content] of Object.entries(WORKSPACE_SEEDS)) {
    const filePath = path.join(workspace, file);
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  return { workspace, agentDir, sessionsDir };
}

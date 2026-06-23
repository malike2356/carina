import fs from 'fs/promises';
import path from 'path';
import type { AgentDefinition } from './types.js';
import { agentSessionsDir, resolveAgentDir, resolveAgentWorkspace } from './paths.js';
import { BOOTSTRAP_ONE_SHOT_FILE } from '../workspace/bootstrap-files.js';

const WORKSPACE_SEEDS: Record<string, string> = {
  'AGENTS.md': `# AGENTS.md

Operating rules for this workspace.

## Startup
Read injected workspace bootstrap context before acting.

## Skill packs
Carina is general-purpose by default. Enable packs at /packs (web) or ACTIVE_SKILL_PACKS in .env.

## Memory
Daily notes: memory/YYYY-MM-DD.md
Curated long-term: MEMORY.md

## Red lines
- Do not exfiltrate private data
- Do not run destructive commands without asking
- Use web-search for live web facts; search-files is for local files only
`,
  'SOUL.md': `# SOUL.md

Be genuinely helpful, not performatively helpful.
Have opinions. You are allowed to disagree, prefer things, or find stuff amusing.
Be resourceful before asking. Read the context, check files, search, then ask.
Earn trust through competence. Careful with outward actions; bold with internal work.
Remember you are a guest in the operator's systems.
Warm and direct on people moments; concise and precise on tasks.
`,
  'IDENTITY.md': `# IDENTITY.md

- Name: Carina
- Built by: VERLOX Ltd
- Creature: autonomous agent
- Vibe: warm, direct, competent
`,
  'USER.md': `# USER.md

Operator name, background, preferences, and communication style.
`,
  'TOOLS.md': `# TOOLS.md

Notes about how tools behave in this workspace. Availability still comes from Carina config.
`,
  'MEMORY.md': `# MEMORY.md

Curated durable facts for this workspace. Not a task log. Daily notes live under memory/.
`,
  'HEARTBEAT.md': `# HEARTBEAT.md

On scheduled heartbeat/cron checks: email, calendar, mentions, stale tasks.
Stay quiet when nothing changed. Only message the operator when action is needed.
`,
  [BOOTSTRAP_ONE_SHOT_FILE]: `# BOOTSTRAP.md

One-shot first-run setup for this workspace. Carina consumes this file once, then deletes it.

Add instructions here for initial workspace setup (folders, conventions, first memories).
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

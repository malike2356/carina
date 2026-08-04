import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveCarinaHome } from '../config/paths.js';
import { appendLearningEvent } from './learning-events.js';
import { getSkillByName } from './store.js';
import { loadAgentsConfig } from '../workspaces/agent-registry.js';
import type { ShareLearningPolicy } from '../workspaces/types.js';
import { updateAgentSync } from '../sync/agent-sync.js';

export interface SharedSkillRecord {
  skillName: string;
  skillId: string;
  sourceAgentId: string;
  targetAgentIds: string[];
  propagatedAt: string;
  learningEventId?: string | null;
  summary: string;
}

interface SharedSkillsIndex {
  version: number;
  skills: SharedSkillRecord[];
}

function sharedSkillsPath(): string {
  return path.join(resolveCarinaHome(), 'shared-skills.json');
}

async function readSharedSkillsIndex(): Promise<SharedSkillsIndex> {
  try {
    const raw = await fs.readFile(sharedSkillsPath(), 'utf8');
    const parsed = JSON.parse(raw) as SharedSkillsIndex;
    return { version: parsed.version ?? 1, skills: parsed.skills ?? [] };
  } catch {
    return { version: 1, skills: [] };
  }
}

async function writeSharedSkillsIndex(index: SharedSkillsIndex): Promise<void> {
  await fs.mkdir(resolveCarinaHome(), { recursive: true });
  await fs.writeFile(sharedSkillsPath(), JSON.stringify(index, null, 2), 'utf8');
}

export function resolveShareLearningPolicy(): ShareLearningPolicy {
  const policy = loadAgentsConfig().learning?.shareAcrossAgents;
  return policy ?? { mode: 'kernel', minSuccessCount: 2 };
}

export function resolvePropagationTargets(
  sourceAgentId: string,
  policy: ShareLearningPolicy = resolveShareLearningPolicy(),
): string[] {
  if (policy.mode === 'off') return [];
  const config = loadAgentsConfig();
  const allAgentIds = config.agents.map((a) => a.id).filter((id) => id !== sourceAgentId);

  if (policy.mode === 'allowlist') {
    const allow = new Set(policy.allowAgents ?? []);
    return allAgentIds.filter((id) => allow.has(id));
  }

  return allAgentIds;
}

export async function listSharedSkillsForAgent(agentId: string): Promise<SharedSkillRecord[]> {
  const index = await readSharedSkillsIndex();
  return index.skills.filter((s) => s.targetAgentIds.includes(agentId) || s.sourceAgentId === agentId);
}

export async function loadSharedSkillsContext(agentId: string): Promise<string> {
  const rows = await listSharedSkillsForAgent(agentId);
  if (rows.length === 0) return '';

  const lines = rows.slice(0, 12).map((row) => (
    `- ${row.skillName} (from ${row.sourceAgentId}, shared ${row.propagatedAt}): ${row.summary}`
  ));
  return `Shared skills from other agents (kernel learning):\n${lines.join('\n')}`;
}

export async function propagateSkillAcrossAgents(input: {
  skillName: string;
  sourceAgentId: string;
  tenantId?: string;
  sessionId?: string;
  learningEventId?: string | null;
  successCount?: number;
}): Promise<{ propagated: boolean; targets: string[]; reason?: string }> {
  const policy = resolveShareLearningPolicy();
  if (policy.mode === 'off') {
    return { propagated: false, targets: [], reason: 'sharing_disabled' };
  }

  const minSuccess = policy.minSuccessCount ?? 2;
  if ((input.successCount ?? 0) < minSuccess && policy.mode !== 'allowlist') {
    return { propagated: false, targets: [], reason: 'below_success_threshold' };
  }

  const skill = await getSkillByName(input.skillName);
  if (!skill) {
    return { propagated: false, targets: [], reason: 'skill_not_found' };
  }

  const targets = resolvePropagationTargets(input.sourceAgentId, policy);
  if (targets.length === 0) {
    return { propagated: false, targets: [], reason: 'no_targets' };
  }

  const index = await readSharedSkillsIndex();
  const existing = index.skills.find((s) => s.skillName === input.skillName && s.sourceAgentId === input.sourceAgentId);
  const record: SharedSkillRecord = existing ?? {
    skillName: input.skillName,
    skillId: skill.id,
    sourceAgentId: input.sourceAgentId,
    targetAgentIds: [],
    propagatedAt: new Date().toISOString(),
    learningEventId: input.learningEventId,
    summary: skill.description.slice(0, 200),
  };

  record.targetAgentIds = [...new Set([...record.targetAgentIds, ...targets])];
  record.propagatedAt = new Date().toISOString();
  record.summary = skill.description.slice(0, 200);

  if (existing) {
    index.skills = index.skills.map((s) => (s.skillName === record.skillName && s.sourceAgentId === record.sourceAgentId ? record : s));
  } else {
    index.skills.unshift(record);
    index.skills = index.skills.slice(0, 500);
  }
  await writeSharedSkillsIndex(index);

  const eventId = await appendLearningEvent({
    tenantId: input.tenantId ?? '__operator__',
    sessionId: input.sessionId,
    eventType: 'skill_propagated',
    skillId: skill.id,
    skillName: skill.name,
    inputSummary: {
      sourceAgentId: input.sourceAgentId,
      policyMode: policy.mode,
    },
    outputSummary: {
      targetAgentIds: targets,
      sharedSkillPath: sharedSkillsPath(),
    },
  });

  await updateAgentSync(input.sourceAgentId, {
    summary: `Shared skill "${skill.name}" with ${targets.join(', ')}`,
    facts: [`skill:${skill.name}`, `targets:${targets.join(',')}`],
    session_id: input.sessionId,
  });

  return { propagated: true, targets };
}

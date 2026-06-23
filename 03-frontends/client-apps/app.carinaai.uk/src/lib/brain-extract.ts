import { and, eq, ilike } from 'drizzle-orm';
import { db } from '@/db';
import { userMemories, workspaceSkills } from '@/db/schema';
import { getWorkspaceBrainSettings, type BrainSettings } from '@/lib/brain-settings';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { completeWorkspacePrompt } from '@/lib/workspace-llm';

interface ExtractedMemory {
  content: string;
  type?: string;
  confidence?: number;
}

interface ExtractedSkill {
  name: string;
  description?: string;
  confidence?: number;
}

const VALID_MEMORY_TYPES = new Set(['fact', 'preference', 'instruction', 'contact']);

function parseJsonBlock<T>(raw: string): T | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export async function triggerBrainExtraction(input: {
  workspaceId: string;
  sessionId: string;
  mode?: 'chat' | 'agent';
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  const settings = await getWorkspaceBrainSettings(input.workspaceId);
  const mode = input.mode ?? 'chat';
  const shouldExtractMemories = settings.autoExtractMemories;
  const shouldExtractSkills = settings.autoExtractSkills && mode === 'agent';

  if (!shouldExtractMemories && !shouldExtractSkills) return;
  if (!input.assistantMessage.trim()) return;

  const keys = await getDecryptedWorkspaceKeys(input.workspaceId);
  if (keys.length === 0) return;

  await Promise.allSettled([
    shouldExtractMemories
      ? extractMemoriesFromExchange(input.workspaceId, input.userMessage, input.assistantMessage, keys)
      : Promise.resolve(),
    shouldExtractSkills
      ? extractSkillsFromExchange(input.workspaceId, input.userMessage, input.assistantMessage, keys, settings)
      : Promise.resolve(),
  ]);
}

async function extractMemoriesFromExchange(
  workspaceId: string,
  userMessage: string,
  assistantMessage: string,
  keys: Array<{ provider: string; apiKey: string }>,
): Promise<void> {
  const raw = await completeWorkspacePrompt(
    keys,
    `Extract durable facts about the user from the conversation. Return ONLY JSON:
{"memories":[{"content":"string","type":"fact|preference|instruction|contact","confidence":0-100}]}
Rules: max 3 items; skip greetings and transient chat; empty array if nothing worth saving.`,
    `User:\n${userMessage.slice(0, 2000)}\n\nAssistant:\n${assistantMessage.slice(0, 2000)}`,
  );

  const parsed = parseJsonBlock<{ memories?: ExtractedMemory[] }>(raw);
  const memories = parsed?.memories ?? [];
  for (const memory of memories.slice(0, 3)) {
    const content = String(memory.content ?? '').trim();
    if (content.length < 8) continue;

    const [existing] = await db
      .select({ id: userMemories.id })
      .from(userMemories)
      .where(and(eq(userMemories.workspaceId, workspaceId), ilike(userMemories.content, content)))
      .limit(1);
    if (existing) continue;

    const type = VALID_MEMORY_TYPES.has(String(memory.type))
      ? (String(memory.type) as 'fact' | 'preference' | 'instruction' | 'contact')
      : 'fact';

    await db.insert(userMemories).values({
      workspaceId,
      content,
      type,
      source: 'conversation',
      confidence: Math.min(100, Math.max(1, Number(memory.confidence ?? 80))),
      enabled: true,
    });
  }
}

async function extractSkillsFromExchange(
  workspaceId: string,
  userMessage: string,
  assistantMessage: string,
  keys: Array<{ provider: string; apiKey: string }>,
  settings: BrainSettings,
): Promise<void> {
  const raw = await completeWorkspacePrompt(
    keys,
    `Extract a reusable agent procedure learned from this task. Return ONLY JSON:
{"skills":[{"name":"short title","description":"when and how to use this procedure","confidence":0-100}]}
Rules: max 1 skill; skip if nothing reusable; empty array if not applicable.`,
    `User:\n${userMessage.slice(0, 2000)}\n\nAssistant:\n${assistantMessage.slice(0, 2000)}`,
  );

  const parsed = parseJsonBlock<{ skills?: ExtractedSkill[] }>(raw);
  const skills = parsed?.skills ?? [];
  const skill = skills[0];
  if (!skill) return;

  const name = String(skill.name ?? '').trim();
  const description = String(skill.description ?? '').trim();
  if (!name || name.length < 4) return;

  const confidence = Math.min(100, Math.max(1, Number(skill.confidence ?? 70)));
  const skillId = `learned:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;

  const [existing] = await db
    .select({ id: workspaceSkills.id })
    .from(workspaceSkills)
    .where(and(eq(workspaceSkills.workspaceId, workspaceId), eq(workspaceSkills.skillId, skillId)))
    .limit(1);
  if (existing) return;

  await db.insert(workspaceSkills).values({
      workspaceId,
      skillId,
      isCustom: true,
      name,
      description,
      tags: ['learned', 'auto-extract'],
      enabled: confidence >= settings.autoApproveSkillsMinConfidence,
    });
}

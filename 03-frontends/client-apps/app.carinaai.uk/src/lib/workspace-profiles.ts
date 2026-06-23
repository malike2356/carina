import fs from 'node:fs';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceProfiles } from '@/db/schema';

export const BUILTIN_WORKSPACE_PROFILE_IDS = {
  support: 'support',
} as const;

export type BuiltinWorkspaceProfileId =
  (typeof BUILTIN_WORKSPACE_PROFILE_IDS)[keyof typeof BUILTIN_WORKSPACE_PROFILE_IDS];

const SUPPORT_PROMPT_PATH = path.join(
  process.cwd(),
  'src/lib/support/system-prompt.md',
);

let cachedSupportPrompt: string | null = null;

export function loadSupportSystemPrompt(): string {
  if (cachedSupportPrompt) return cachedSupportPrompt;
  const content = fs.readFileSync(SUPPORT_PROMPT_PATH, 'utf8').trim();
  if (!content) {
    throw new Error('Support system prompt is empty');
  }
  cachedSupportPrompt = content;
  return content;
}

export async function listWorkspaceProfiles(workspaceId: string) {
  return db
    .select()
    .from(workspaceProfiles)
    .where(eq(workspaceProfiles.workspaceId, workspaceId))
    .orderBy(workspaceProfiles.name);
}

export async function getWorkspaceProfile(workspaceId: string, profileId: string) {
  const [profile] = await db
    .select()
    .from(workspaceProfiles)
    .where(and(eq(workspaceProfiles.workspaceId, workspaceId), eq(workspaceProfiles.id, profileId)))
    .limit(1);
  return profile ?? null;
}

export async function getWorkspaceProfileByBuiltinId(
  workspaceId: string,
  builtinId: BuiltinWorkspaceProfileId,
) {
  const [profile] = await db
    .select()
    .from(workspaceProfiles)
    .where(
      and(
        eq(workspaceProfiles.workspaceId, workspaceId),
        eq(workspaceProfiles.builtinId, builtinId),
      ),
    )
    .limit(1);
  return profile ?? null;
}

export async function seedBuiltinWorkspaceProfiles(workspaceId: string): Promise<void> {
  const existing = await getWorkspaceProfileByBuiltinId(
    workspaceId,
    BUILTIN_WORKSPACE_PROFILE_IDS.support,
  );
  if (existing) return;

  const prompt = loadSupportSystemPrompt();
  await db.insert(workspaceProfiles).values({
    workspaceId,
    slug: BUILTIN_WORKSPACE_PROFILE_IDS.support,
    name: 'Support',
    description: 'Carina AI and Labyrinth Scout product support with embedded knowledge.',
    systemPrompt: prompt,
    isBuiltin: true,
    builtinId: BUILTIN_WORKSPACE_PROFILE_IDS.support,
  });
}

export async function ensureWorkspaceProfiles(workspaceId: string) {
  await seedBuiltinWorkspaceProfiles(workspaceId);
  return listWorkspaceProfiles(workspaceId);
}

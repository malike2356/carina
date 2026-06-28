import fs from 'node:fs';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceProfiles } from '@/db/schema';
import {
  BUILTIN_WORKSPACE_PROFILE_IDS,
  BUILTIN_WORKSPACE_PROFILE_LIST,
  getBuiltinWorkspaceProfileDefinition,
  type BuiltinWorkspaceProfileId,
} from '@/lib/builtin-workspace-profiles';

export {
  BUILTIN_WORKSPACE_PROFILE_IDS,
  type BuiltinWorkspaceProfileId,
} from '@/lib/builtin-workspace-profiles';

export const RESERVED_WORKSPACE_PROFILE_SLUGS = new Set([
  'default',
  'new',
  ...BUILTIN_WORKSPACE_PROFILE_LIST.map((definition) => definition.slug),
]);

export const MAX_WORKSPACE_PROFILE_SYSTEM_PROMPT_CHARS = 120_000;

export type WorkspaceProfileInput = {
  name: string;
  slug?: string;
  description?: string | null;
  systemPrompt: string;
  provider?: string | null;
  model?: string | null;
};

const PROMPT_ROOT_RELATIVE = path.join('src', 'lib');

function promptFileCandidates(relativePath: string): string[] {
  const cwd = process.cwd();
  const normalized = relativePath.split(path.sep).join(path.sep);
  return [
    path.join(cwd, PROMPT_ROOT_RELATIVE, normalized),
    path.join(cwd, '..', PROMPT_ROOT_RELATIVE, normalized),
  ];
}

export function resolveBuiltinProfilePromptPath(relativePath: string): string {
  for (const candidate of promptFileCandidates(relativePath)) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Built-in profile prompt not found for ${relativePath}. Checked: ${promptFileCandidates(relativePath).join(', ')}`,
  );
}

const cachedBuiltinPrompts = new Map<string, string>();

export function loadBuiltinProfilePrompt(relativePath: string): string {
  const cached = cachedBuiltinPrompts.get(relativePath);
  if (cached) return cached;

  const promptPath = resolveBuiltinProfilePromptPath(relativePath);
  const content = fs.readFileSync(promptPath, 'utf8').trim();
  if (!content) {
    throw new Error(`Built-in profile prompt is empty: ${relativePath}`);
  }
  cachedBuiltinPrompts.set(relativePath, content);
  return content;
}

export function loadSupportSystemPrompt(): string {
  return loadBuiltinProfilePrompt(
    getBuiltinWorkspaceProfileDefinition(BUILTIN_WORKSPACE_PROFILE_IDS.support).promptRelativePath,
  );
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
  for (const definition of BUILTIN_WORKSPACE_PROFILE_LIST) {
    const existing = await getWorkspaceProfileByBuiltinId(workspaceId, definition.id);
    if (existing) continue;

    const prompt = loadBuiltinProfilePrompt(definition.promptRelativePath);
    await db.insert(workspaceProfiles).values({
      workspaceId,
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      systemPrompt: prompt,
      isBuiltin: true,
      builtinId: definition.id,
    });
  }
}

export async function ensureWorkspaceProfiles(workspaceId: string) {
  await seedBuiltinWorkspaceProfiles(workspaceId);
  return listWorkspaceProfiles(workspaceId);
}

export function normalizeProfileSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function validateWorkspaceProfileInput(input: WorkspaceProfileInput): string | null {
  const name = input.name.trim();
  if (!name) return 'Name is required';
  if (name.length > 120) return 'Name must be 120 characters or fewer';

  const slug = normalizeProfileSlug(input.slug?.trim() || name);
  if (!slug) return 'Slug is required';
  if (RESERVED_WORKSPACE_PROFILE_SLUGS.has(slug)) {
    return `Slug "${slug}" is reserved`;
  }

  const systemPrompt = input.systemPrompt.trim();
  if (!systemPrompt) return 'System prompt is required';
  if (systemPrompt.length > MAX_WORKSPACE_PROFILE_SYSTEM_PROMPT_CHARS) {
    return `System prompt must be ${MAX_WORKSPACE_PROFILE_SYSTEM_PROMPT_CHARS} characters or fewer`;
  }

  if (input.description && input.description.trim().length > 500) {
    return 'Description must be 500 characters or fewer';
  }

  return null;
}

async function resolveUniqueProfileSlug(
  workspaceId: string,
  preferredSlug: string,
  excludeProfileId?: string,
): Promise<string> {
  let candidate = preferredSlug;
  let suffix = 2;
  while (true) {
    const [existing] = await db
      .select({ id: workspaceProfiles.id })
      .from(workspaceProfiles)
      .where(
        and(eq(workspaceProfiles.workspaceId, workspaceId), eq(workspaceProfiles.slug, candidate)),
      )
      .limit(1);
    if (!existing || existing.id === excludeProfileId) return candidate;
    candidate = `${preferredSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function createWorkspaceProfile(
  workspaceId: string,
  input: WorkspaceProfileInput,
) {
  const validationError = validateWorkspaceProfileInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const name = input.name.trim();
  const slug = await resolveUniqueProfileSlug(
    workspaceId,
    normalizeProfileSlug(input.slug?.trim() || name),
  );

  const [created] = await db
    .insert(workspaceProfiles)
    .values({
      workspaceId,
      slug,
      name,
      description: input.description?.trim() || null,
      systemPrompt: input.systemPrompt.trim(),
      provider: input.provider?.trim() || null,
      model: input.model?.trim() || null,
      isBuiltin: false,
      builtinId: null,
    })
    .returning();

  return created;
}

export async function cloneWorkspaceProfile(workspaceId: string, profileId: string) {
  const source = await getWorkspaceProfile(workspaceId, profileId);
  if (!source) {
    throw new Error('Profile not found');
  }
  if (!source.systemPrompt?.trim()) {
    throw new Error('Profile has no system prompt to clone');
  }

  const copyName = `${source.name} copy`.slice(0, 120);
  const copySlug = await resolveUniqueProfileSlug(
    workspaceId,
    normalizeProfileSlug(`${source.slug}-copy`),
  );

  return createWorkspaceProfile(workspaceId, {
    name: copyName,
    slug: copySlug,
    description: source.description,
    systemPrompt: source.systemPrompt,
    provider: source.provider,
    model: source.model,
  });
}

export async function updateWorkspaceProfile(
  workspaceId: string,
  profileId: string,
  input: WorkspaceProfileInput,
) {
  const existing = await getWorkspaceProfile(workspaceId, profileId);
  if (!existing) {
    throw new Error('Profile not found');
  }
  if (existing.isBuiltin) {
    throw new Error('Built-in profiles cannot be edited');
  }

  const validationError = validateWorkspaceProfileInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const name = input.name.trim();
  const slug = await resolveUniqueProfileSlug(
    workspaceId,
    normalizeProfileSlug(input.slug?.trim() || name),
    profileId,
  );

  const [updated] = await db
    .update(workspaceProfiles)
    .set({
      slug,
      name,
      description: input.description?.trim() || null,
      systemPrompt: input.systemPrompt.trim(),
      provider: input.provider?.trim() || null,
      model: input.model?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(workspaceProfiles.workspaceId, workspaceId), eq(workspaceProfiles.id, profileId)))
    .returning();

  return updated;
}

export async function deleteWorkspaceProfile(workspaceId: string, profileId: string) {
  const existing = await getWorkspaceProfile(workspaceId, profileId);
  if (!existing) {
    throw new Error('Profile not found');
  }
  if (existing.isBuiltin) {
    throw new Error('Built-in profiles cannot be deleted');
  }

  await db
    .delete(workspaceProfiles)
    .where(and(eq(workspaceProfiles.workspaceId, workspaceId), eq(workspaceProfiles.id, profileId)));
}

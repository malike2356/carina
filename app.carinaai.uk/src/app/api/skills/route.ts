import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSkills } from '@/db/schema';
import { CLOUD_SKILLS } from '@/lib/cloud-capabilities';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 20);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const rows = await db
    .select()
    .from(workspaceSkills)
    .where(eq(workspaceSkills.workspaceId, workspace.id));

  const enabledMap = new Map(rows.map((row) => [row.skillId, row.enabled]));
  const platformList = CLOUD_SKILLS.map((skill) => ({
    ...skill,
    enabled: enabledMap.has(skill.id) ? enabledMap.get(skill.id) : true,
    isCustom: false,
  }));
  const customList = rows
    .filter((row) => row.isCustom)
    .map((row) => ({
      id: row.skillId,
      name: row.name ?? '',
      description: row.description ?? '',
      category: 'custom',
      tags: row.tags,
      enabled: row.enabled,
      githubUrl: row.githubUrl,
      isCustom: true,
    }));

  return NextResponse.json({ data: [...platformList, ...customList] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    githubUrl?: string | null;
    tags?: string[];
  };
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const [created] = await db
    .insert(workspaceSkills)
    .values({
      workspaceId: workspace.id,
      skillId: `custom:${crypto.randomUUID()}`,
      isCustom: true,
      name,
      description: body.description?.trim() ?? '',
      githubUrl: body.githubUrl?.trim() || null,
      tags: parseTags(body.tags),
      enabled: true,
    })
    .returning();

  return NextResponse.json({ data: created });
}

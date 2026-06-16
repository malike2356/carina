import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSkills } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PLATFORM_SKILLS = [
  { id: 'web_search', name: 'Web Search', description: 'Search the internet for up-to-date information using Brave or SerpAPI.', category: 'research', tags: ['search', 'internet'] },
  { id: 'shell_exec', name: 'Shell Execute', description: 'Run shell commands in a sandboxed environment. Requires operator approval.', category: 'code', tags: ['shell', 'terminal'] },
  { id: 'read_file', name: 'Read File', description: 'Read content from uploaded or linked files (PDF, DOCX, TXT, CSV).', category: 'files', tags: ['files', 'documents'] },
  { id: 'write_file', name: 'Write File', description: 'Create or overwrite files in the workspace scratch directory.', category: 'files', tags: ['files'] },
  { id: 'memory_read', name: 'Memory Read', description: 'Retrieve relevant memories to inject into the current context automatically.', category: 'memory', tags: ['memory'] },
  { id: 'memory_write', name: 'Memory Write', description: 'Extract and save new facts from conversations to the memory store.', category: 'memory', tags: ['memory', 'extraction'] },
  { id: 'rag_search', name: 'RAG Search', description: 'Search the RAG corpus for relevant document chunks.', category: 'knowledge', tags: ['rag', 'knowledge'] },
  { id: 'calendar_read', name: 'Calendar Read', description: 'Read upcoming events from connected calendar (Google/Outlook).', category: 'integration', tags: ['calendar'] },
  { id: 'calendar_write', name: 'Calendar Write', description: 'Create or update calendar events on connected accounts.', category: 'integration', tags: ['calendar'] },
  { id: 'email_send', name: 'Email Send', description: 'Draft and send emails via connected email account. Requires explicit approval.', category: 'integration', tags: ['email', 'communication'] },
  { id: 'crm_lookup', name: 'CRM Lookup', description: 'Query connected CRM for contact and deal information.', category: 'integration', tags: ['crm', 'contacts'] },
  { id: 'property_search', name: 'Property Search', description: 'Search Rightmove, Zoopla, or OnTheMarket listings via API.', category: 'property', tags: ['property', 'search'] },
  { id: 'land_registry', name: 'Land Registry', description: 'Query UK Land Registry for title information and price history.', category: 'property', tags: ['property', 'legal'] },
  { id: 'pdf_generate', name: 'PDF Generator', description: 'Render structured output as a PDF for download or email.', category: 'files', tags: ['pdf', 'export'] },
  { id: 'code_exec', name: 'Code Executor', description: 'Execute Python snippets for data analysis and calculations.', category: 'code', tags: ['python', 'data'] },
];

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
  const platformList = PLATFORM_SKILLS.map((skill) => ({
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

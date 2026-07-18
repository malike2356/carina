import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents, userMemories } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

type GraphNode = {
  id: string;
  label: string;
  kind: 'note' | 'doc' | 'session' | 'memory' | 'skill';
  size?: number;
  href?: string;
};

type GraphEdge = { source: string; target: string; weight?: number };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const memories = await db
    .select()
    .from(userMemories)
    .where(eq(userMemories.workspaceId, workspace.id))
    .orderBy(desc(userMemories.updatedAt))
    .limit(80);

  for (const row of memories) {
    const id = `memory:${row.id}`;
    nodes.push({
      id,
      label: (row.content || 'Memory').slice(0, 48),
      kind: 'memory',
      size: 28,
      href: '/knowledge',
    });
  }

  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.workspaceId, workspace.id), eq(documents.archived, false)))
    .orderBy(desc(documents.updatedAt))
    .limit(40);

  for (const doc of docs) {
    const id = `doc:${doc.id}`;
    nodes.push({
      id,
      label: doc.title || 'Document',
      kind: 'doc',
      size: 34,
      href: `/documents/${doc.id}`,
    });
  }

  // Light co-occurrence edges: consecutive memories + docs share hub
  const hubId = 'hub:workspace';
  if (nodes.length) {
    nodes.unshift({
      id: hubId,
      label: 'Workspace brain',
      kind: 'skill',
      size: 48,
      href: '/agent-os/memory',
    });
    for (const node of nodes.slice(1, 120)) {
      edges.push({ source: hubId, target: node.id, weight: 1 });
    }
  }

  const capped = nodes.slice(0, 150);
  const allowed = new Set(capped.map((n) => n.id));
  const cappedEdges = edges.filter((e) => allowed.has(e.source) && allowed.has(e.target));

  return NextResponse.json({
    nodes: capped,
    edges: cappedEdges,
    generatedAt: new Date().toISOString(),
  });
}

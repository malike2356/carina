import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

type SectionResult = {
  available: boolean;
  count: number;
  items: Array<Record<string, unknown>>;
  error?: string;
};

function authorized(request: Request): boolean {
  const key = request.headers.get('x-internal-key')?.trim();
  return Boolean(process.env.CARINA_INTERNAL_KEY && key === process.env.CARINA_INTERNAL_KEY);
}

function rowsFromExecute<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && Array.isArray((value as { rows?: unknown[] }).rows)) {
    return (value as { rows: T[] }).rows;
  }
  return [];
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function section<T extends Record<string, unknown>>(
  query: () => Promise<unknown>,
): Promise<SectionResult> {
  try {
    const rows = rowsFromExecute<T>(await query());
    return { available: true, count: rows.length, items: rows };
  } catch (error) {
    return {
      available: false,
      count: 0,
      items: [],
      error: messageFromError(error),
    };
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId')?.trim() ?? '';
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 10)));

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  const [
    workspaceRows,
    documents,
    research,
    emails,
    notes,
    memories,
    calendar,
    scheduledTasks,
    chatSessions,
    aivas,
    channels,
    automations,
    approvals,
    skills,
  ] = await Promise.all([
    section(() => db.execute(sql`
      SELECT id::text, name, plan, timezone, created_at, updated_at
      FROM workspaces
      WHERE id = ${workspaceId}
      LIMIT 1
    `)),
    section(() => db.execute(sql`
      SELECT id::text, title, format, archived, created_at, updated_at
      FROM documents
      WHERE workspace_id = ${workspaceId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, query, mode, status, rounds, created_at, completed_at, error
      FROM research_jobs
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, from_address, to_address, source, subject, urgency, status, received_at
      FROM email_messages
      WHERE workspace_id = ${workspaceId}
      ORDER BY received_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, title, archived, pinned, reminder_at, created_at, updated_at
      FROM user_notes
      WHERE workspace_id = ${workspaceId}
      ORDER BY pinned DESC, updated_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, type, source, confidence, enabled, tags, created_at, updated_at,
        left(content, 240) AS content_preview
      FROM user_memories
      WHERE workspace_id = ${workspaceId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, title, starts_at, ends_at, all_day, source, created_at, updated_at
      FROM calendar_events
      WHERE workspace_id = ${workspaceId}
      ORDER BY starts_at ASC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, name, description, trigger_type, task_type, status, cron_expression,
        last_run_at, next_run_at, run_count, built_in, created_at, updated_at
      FROM scheduled_tasks
      WHERE workspace_id = ${workspaceId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, title, mode, provider, model, pinned, archived, last_message_at, created_at, updated_at
      FROM chat_sessions
      WHERE workspace_id = ${workspaceId}
      ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, name, role_description, template_id, skill_packs, channels, language, status, created_at, updated_at
      FROM ai_workers
      WHERE workspace_id = ${workspaceId} AND status != 'dismissed'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, worker_id::text, channel, identifier, enabled, connected_at
      FROM ai_worker_channels
      WHERE workspace_id = ${workspaceId}
      ORDER BY connected_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, worker_id::text, name, description, cron_expression, schedule_label,
        trigger_type, trigger_event, enabled, last_run_at, next_run_at, created_at
      FROM ai_worker_automations
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, worker_id::text, category, recipient, subject, status, created_at, approved_at, sent_at
      FROM aiva_email_approvals
      WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)),
    section(() => db.execute(sql`
      SELECT id::text, skill_id, enabled, is_custom, name, tags, added_at, updated_at
      FROM workspace_skills
      WHERE workspace_id = ${workspaceId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `)),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      workspace: workspaceRows.items[0] ?? null,
      sections: {
        documents,
        research,
        emails,
        notes,
        memories,
        calendar,
        scheduledTasks,
        chatSessions,
        aivas,
        channels,
        automations,
        approvals,
        skills,
      },
    },
  });
}

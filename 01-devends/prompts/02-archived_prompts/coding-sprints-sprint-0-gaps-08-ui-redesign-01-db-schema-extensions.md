# Prompt 01 - Database Schema Extensions

## Objective

Extend `src/db/schema.ts` with all tables needed by the redesigned app. Run migrations after. Do NOT touch existing tables (users, sessions, accounts, verifications, workspaces, byokKeys, usageEvents, auditLog).

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

The existing schema uses Drizzle ORM with PostgreSQL. All new tables follow the same conventions: UUID primary keys, `createdAt`/`updatedAt` timestamps, workspaceId foreign key linking to `workspaces.id` with cascade delete, and appropriate indexes.

---

## New Tables to Add

### 1. chatSessions

Persistent chat sessions. Each represents a conversation thread the user can return to.

```ts
export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New chat'),
    model: varchar('model', { length: 120 }).notNull().default(''),
    provider: varchar('provider', { length: 50 }).notNull().default(''),
    mode: varchar('mode', { length: 20 }).notNull().default('chat'), // 'chat' | 'agent'
    pinned: boolean('pinned').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    lastMessageAt: timestamp('last_message_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('chat_sessions_workspace_id_idx').on(t.workspaceId),
    index('chat_sessions_last_message_at_idx').on(t.lastMessageAt),
  ],
);
```

### 2. chatMessages

Individual messages within a chat session.

```ts
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'tool']);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    toolCalls: jsonb('tool_calls'),      // array of { id, name, input, output, durationMs }
    thinkingContent: text('thinking_content'), // reasoning/think block content if present
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    model: varchar('model', { length: 120 }).notNull().default(''),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('chat_messages_session_id_idx').on(t.sessionId),
    index('chat_messages_workspace_id_idx').on(t.workspaceId),
  ],
);
```

### 3. userMemories

User-curated long-term facts that Carina recalls across sessions.

```ts
export const memoryTypeEnum = pgEnum('memory_type', ['fact', 'preference', 'instruction', 'contact']);

export const userMemories = pgTable(
  'user_memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    type: memoryTypeEnum('type').notNull().default('fact'),
    source: varchar('source', { length: 50 }).notNull().default('manual'), // 'manual' | 'extracted' | 'imported'
    confidence: integer('confidence').notNull().default(100), // 0-100
    enabled: boolean('enabled').notNull().default(true),
    tags: text('tags').array().notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('user_memories_workspace_id_idx').on(t.workspaceId),
    index('user_memories_enabled_idx').on(t.enabled),
  ],
);
```

### 4. userNotes

Persistent notes the user can write and pin as context to chat sessions.

```ts
export const userNotes = pgTable(
  'user_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default(''),
    archived: boolean('archived').notNull().default(false),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('user_notes_workspace_id_idx').on(t.workspaceId)],
);
```

### 5. sessionContextPins

Tracks which notes/documents are pinned as context to a chat session.

```ts
export const pinTypeEnum = pgEnum('pin_type', ['note', 'document', 'text']);

export const sessionContextPins = pgTable(
  'session_context_pins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    pinType: pinTypeEnum('pin_type').notNull(),
    referenceId: uuid('reference_id'),  // noteId or documentId when applicable
    label: text('label').notNull(),     // display text in chip
    content: text('content').notNull(), // actual text injected into context
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('session_context_pins_session_id_idx').on(t.sessionId)],
);
```

### 6. scheduledTasks

User-defined recurring tasks that trigger prompts or actions on a schedule.

```ts
export const taskTriggerEnum = pgEnum('task_trigger', [
  'schedule',      // cron expression
  'on_event',      // every N sessions / messages
  'webhook',       // HTTP trigger
]);

export const taskTypeEnum = pgEnum('task_type', [
  'prompt',        // run a prompt
  'research',      // run deep research
  'action',        // run a tidy/cleanup action
]);

export const taskStatusEnum = pgEnum('task_status', ['active', 'paused', 'draft']);

export const scheduledTasks = pgTable(
  'scheduled_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    triggerType: taskTriggerEnum('trigger_type').notNull(),
    taskType: taskTypeEnum('task_type').notNull(),
    status: taskStatusEnum('status').notNull().default('draft'),
    cronExpression: text('cron_expression'),      // when triggerType = 'schedule'
    eventEveryN: integer('event_every_n'),         // when triggerType = 'on_event'
    eventUnit: varchar('event_unit', { length: 20 }), // 'sessions' | 'messages'
    webhookSecret: text('webhook_secret'),          // when triggerType = 'webhook'
    prompt: text('prompt').notNull().default(''),   // the instruction to run
    lastRunAt: timestamp('last_run_at'),
    nextRunAt: timestamp('next_run_at'),
    runCount: integer('run_count').notNull().default(0),
    builtIn: boolean('built_in').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('scheduled_tasks_workspace_id_idx').on(t.workspaceId),
    index('scheduled_tasks_status_idx').on(t.status),
  ],
);
```

### 7. taskRuns

Activity log for task executions.

```ts
export const taskRunStatusEnum = pgEnum('task_run_status', ['running', 'completed', 'failed']);

export const taskRuns = pgTable(
  'task_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => scheduledTasks.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    status: taskRunStatusEnum('status').notNull().default('running'),
    output: text('output'),
    error: text('error'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    index('task_runs_task_id_idx').on(t.taskId),
    index('task_runs_workspace_id_idx').on(t.workspaceId),
    index('task_runs_created_at_idx').on(t.createdAt),
  ],
);
```

### 8. researchJobs

Queued deep research tasks.

```ts
export const researchStatusEnum = pgEnum('research_status', ['queued', 'running', 'completed', 'failed']);

export const researchJobs = pgTable(
  'research_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    mode: varchar('mode', { length: 30 }).notNull().default('auto'), // 'auto' | 'product' | 'compare' | 'how-to' | 'fact-check'
    status: researchStatusEnum('status').notNull().default('queued'),
    rounds: integer('rounds').notNull().default(3),
    output: text('output'),
    sources: jsonb('sources'),  // array of { url, title, snippet }
    error: text('error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    index('research_jobs_workspace_id_idx').on(t.workspaceId),
    index('research_jobs_status_idx').on(t.status),
  ],
);
```

### 9. workspaceSettings

Granular per-workspace UI and behaviour preferences (used by the appearance and settings system).

```ts
export const workspaceSettings = pgTable('workspace_settings', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  // Theme
  theme: varchar('theme', { length: 30 }).notNull().default('dark'),
  customTheme: jsonb('custom_theme'),  // CSS variable overrides
  // Appearance toggles - chat area
  showSessionHeader: boolean('show_session_header').notNull().default(true),
  showWelcomeMessage: boolean('show_welcome_message').notNull().default(true),
  showThinkingProcess: boolean('show_thinking_process').notNull().default(true),
  showTokenMetadata: boolean('show_token_metadata').notNull().default(true),
  // Appearance toggles - chat bar
  showWebSearchButton: boolean('show_web_search_button').notNull().default(true),
  showShellButton: boolean('show_shell_button').notNull().default(false),
  showAgentModeToggle: boolean('show_agent_mode_toggle').notNull().default(true),
  showDeepResearchButton: boolean('show_deep_research_button').notNull().default(true),
  // Appearance toggles - sidebar
  showCalendar: boolean('show_calendar').notNull().default(false),
  showResearch: boolean('show_research').notNull().default(true),
  showTasks: boolean('show_tasks').notNull().default(true),
  showNotes: boolean('show_notes').notNull().default(true),
  showMemory: boolean('show_memory').notNull().default(true),
  showSkills: boolean('show_skills').notNull().default(true),
  // Agent defaults
  defaultMode: varchar('default_mode', { length: 20 }).notNull().default('chat'),
  defaultModel: varchar('default_model', { length: 120 }).notNull().default(''),
  defaultProvider: varchar('default_provider', { length: 50 }).notNull().default(''),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

---

## Types to Export

Add to the bottom of `schema.ts`:

```ts
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type UserMemory = typeof userMemories.$inferSelect;
export type UserNote = typeof userNotes.$inferSelect;
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type TaskRun = typeof taskRuns.$inferSelect;
export type ResearchJob = typeof researchJobs.$inferSelect;
export type WorkspaceSettings = typeof workspaceSettings.$inferSelect;
export type MemoryType = (typeof memoryTypeEnum.enumValues)[number];
export type MessageRole = (typeof messageRoleEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
```

---

## Migration

After editing schema.ts, generate and run the migration:

```bash
pnpm db:generate
pnpm db:migrate
```

Verify all new tables exist in the database before proceeding to Prompt 02.

---

## New Library File: src/lib/chat-sessions.ts

Create this server-side helper so all subsequent prompts can import it:

```ts
import { db } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function getOrCreateSession(
  workspaceId: string,
  sessionId: string | null,
): Promise<string> {
  if (sessionId) {
    const existing = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspaceId)))
      .limit(1);
    if (existing.length > 0) return sessionId;
  }
  const [created] = await db
    .insert(chatSessions)
    .values({ workspaceId, title: 'New chat' })
    .returning({ id: chatSessions.id });
  return created.id;
}

export async function saveMessage(params: {
  sessionId: string;
  workspaceId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: unknown[];
  thinkingContent?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  model?: string;
}): Promise<void> {
  await db.insert(chatMessages).values({
    sessionId: params.sessionId,
    workspaceId: params.workspaceId,
    role: params.role,
    content: params.content,
    toolCalls: params.toolCalls ?? null,
    thinkingContent: params.thinkingContent ?? null,
    inputTokens: params.inputTokens ?? 0,
    outputTokens: params.outputTokens ?? 0,
    durationMs: params.durationMs ?? 0,
    model: params.model ?? '',
  });
  await db
    .update(chatSessions)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(chatSessions.id, params.sessionId));
}

export async function getSessionMessages(sessionId: string, workspaceId: string) {
  return db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, sessionId),
        eq(chatMessages.workspaceId, workspaceId),
      ),
    )
    .orderBy(chatMessages.createdAt);
}

export async function listSessions(workspaceId: string, limit = 50) {
  return db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.workspaceId, workspaceId),
        eq(chatSessions.archived, false),
      ),
    )
    .orderBy(desc(chatSessions.lastMessageAt))
    .limit(limit);
}

export async function autoTitleSession(sessionId: string, firstUserMessage: string): Promise<void> {
  const title = firstUserMessage.slice(0, 60).trim() || 'New chat';
  await db
    .update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}
```

---

## Verification

After running migrations confirm:
1. `chat_sessions` table exists with all columns
2. `chat_messages` table exists with all columns
3. `user_memories` table exists
4. `user_notes` table exists
5. `session_context_pins` table exists
6. `scheduled_tasks` table exists
7. `task_runs` table exists
8. `research_jobs` table exists
9. `workspace_settings` table exists
10. `src/lib/chat-sessions.ts` has been created and compiles without errors (`pnpm build` or `pnpm check`)

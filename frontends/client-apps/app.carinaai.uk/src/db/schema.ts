import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const planEnum = pgEnum('workspace_plan', ['free', 'starter', 'team']);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('My workspace'),
    plan: planEnum('plan').notNull().default('free'),
    timezone: text('timezone').notNull().default('UTC'),
    activeSkillPacks: text('active_skill_packs').notNull().default(''),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    currentPeriodEnd: timestamp('current_period_end'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('workspaces_user_id_idx').on(t.userId)],
);

export const byokKeys = pgTable(
  'byok_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    encryptedKey: text('encrypted_key').notNull(),
    iv: text('iv').notNull(),
    tag: text('tag').notNull(),
    keyHint: varchar('key_hint', { length: 8 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('byok_keys_workspace_id_idx').on(t.workspaceId)],
);

export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    model: varchar('model', { length: 120 }).notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('usage_events_workspace_id_idx').on(t.workspaceId),
    index('usage_events_created_at_idx').on(t.createdAt),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    detail: jsonb('detail'),
    ipHash: varchar('ip_hash', { length: 64 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_workspace_id_idx').on(t.workspaceId),
    index('audit_log_action_idx').on(t.action),
  ],
);

export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'tool']);

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
    mode: varchar('mode', { length: 20 }).notNull().default('chat'),
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
    toolCalls: jsonb('tool_calls'),
    thinkingContent: text('thinking_content'),
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
    source: varchar('source', { length: 50 }).notNull().default('manual'),
    confidence: integer('confidence').notNull().default(100),
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

export const userNotes = pgTable(
  'user_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default(''),
    reminderAt: timestamp('reminder_at'),
    archived: boolean('archived').notNull().default(false),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('user_notes_workspace_id_idx').on(t.workspaceId)],
);

export const workspaceSkills = pgTable(
  'workspace_skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    skillId: text('skill_id').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    isCustom: boolean('is_custom').notNull().default(false),
    name: text('name'),
    description: text('description'),
    githubUrl: text('github_url'),
    tags: text('tags').array().notNull().default([]),
    addedAt: timestamp('added_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('workspace_skills_workspace_id_idx').on(t.workspaceId),
    index('workspace_skills_workspace_skill_uniq').on(t.workspaceId, t.skillId),
  ],
);

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
    referenceId: uuid('reference_id'),
    label: text('label').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('session_context_pins_session_id_idx').on(t.sessionId)],
);

export const taskTriggerEnum = pgEnum('task_trigger', ['schedule', 'on_event', 'webhook']);

export const taskTypeEnum = pgEnum('task_type', ['prompt', 'research', 'action']);

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
    cronExpression: text('cron_expression'),
    eventEveryN: integer('event_every_n'),
    eventUnit: varchar('event_unit', { length: 20 }),
    webhookSecret: text('webhook_secret'),
    prompt: text('prompt').notNull().default(''),
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

export const researchStatusEnum = pgEnum('research_status', ['queued', 'running', 'completed', 'failed']);

export const researchJobs = pgTable(
  'research_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    mode: varchar('mode', { length: 30 }).notNull().default('auto'),
    status: researchStatusEnum('status').notNull().default('queued'),
    rounds: integer('rounds').notNull().default(3),
    output: text('output'),
    sources: jsonb('sources'),
    error: text('error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    index('research_jobs_workspace_id_idx').on(t.workspaceId),
    index('research_jobs_status_idx').on(t.status),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'set null' }),
    title: text('title').notNull().default('Untitled'),
    content: text('content').notNull().default(''),
    format: varchar('format', { length: 20 }).notNull().default('markdown'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('documents_workspace_id_idx').on(t.workspaceId),
    index('documents_updated_at_idx').on(t.updatedAt),
  ],
);

export const emailMessages = pgTable(
  'email_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    fromAddress: text('from_address').notNull(),
    subject: text('subject').notNull().default(''),
    bodyPreview: text('body_preview'),
    bodyFull: text('body_full'),
    urgency: varchar('urgency', { length: 20 }).notNull().default('normal'),
    status: varchar('status', { length: 30 }).notNull().default('inbox'),
    aiDraftReply: text('ai_draft_reply'),
    aiDraftGeneratedAt: timestamp('ai_draft_generated_at'),
    receivedAt: timestamp('received_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('email_messages_workspace_id_idx').on(t.workspaceId),
    index('email_messages_status_idx').on(t.status),
    index('email_messages_received_at_idx').on(t.receivedAt),
  ],
);

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    externalUid: text('external_uid'),
    title: text('title').notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at'),
    allDay: boolean('all_day').notNull().default(false),
    source: varchar('source', { length: 30 }).notNull().default('local'),
    noteId: uuid('note_id').references(() => userNotes.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('calendar_events_workspace_id_idx').on(t.workspaceId),
    index('calendar_events_starts_at_idx').on(t.startsAt),
    index('calendar_events_external_uid_idx').on(t.externalUid),
  ],
);

export const calendarConnections = pgTable(
  'calendar_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 30 }).notNull().default('caldav'),
    url: text('url'),
    username: text('username'),
    encryptedPassword: text('encrypted_password'),
    passwordIv: text('password_iv'),
    passwordTag: text('password_tag'),
    lastSyncAt: timestamp('last_sync_at'),
    lastSyncError: text('last_sync_error'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('calendar_connections_workspace_id_idx').on(t.workspaceId)],
);

export const workspaceSettings = pgTable('workspace_settings', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  inboundEmailToken: text('inbound_email_token'),
  theme: varchar('theme', { length: 30 }).notNull().default('dark'),
  customTheme: jsonb('custom_theme'),
  appearance: jsonb('appearance'),
  showSessionHeader: boolean('show_session_header').notNull().default(true),
  showWelcomeMessage: boolean('show_welcome_message').notNull().default(true),
  showThinkingProcess: boolean('show_thinking_process').notNull().default(true),
  showTokenMetadata: boolean('show_token_metadata').notNull().default(true),
  showWebSearchButton: boolean('show_web_search_button').notNull().default(true),
  showShellButton: boolean('show_shell_button').notNull().default(false),
  showAgentModeToggle: boolean('show_agent_mode_toggle').notNull().default(true),
  showDeepResearchButton: boolean('show_deep_research_button').notNull().default(true),
  showCalendar: boolean('show_calendar').notNull().default(true),
  showResearch: boolean('show_research').notNull().default(true),
  showTasks: boolean('show_tasks').notNull().default(true),
  showNotes: boolean('show_notes').notNull().default(true),
  showMemory: boolean('show_memory').notNull().default(true),
  showSkills: boolean('show_skills').notNull().default(true),
  defaultMode: varchar('default_mode', { length: 20 }).notNull().default('chat'),
  defaultModel: varchar('default_model', { length: 120 }).notNull().default(''),
  defaultProvider: varchar('default_provider', { length: 50 }).notNull().default(''),
  autoExtractMemories: boolean('auto_extract_memories').notNull().default(true),
  autoExtractSkills: boolean('auto_extract_skills').notNull().default(false),
  autoApproveSkillsMinConfidence: integer('auto_approve_skills_min_confidence').notNull().default(85),
  maxSkillsPerRequest: integer('max_skills_per_request').notNull().default(3),
  injectMemoriesInChat: boolean('inject_memories_in_chat').notNull().default(true),
  terminalEnabled: boolean('terminal_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 30 }).notNull().default('member'),
    permissions: jsonb('permissions').notNull().default({}),
    invitedAt: timestamp('invited_at').notNull().defaultNow(),
  },
  (t) => [
    index('workspace_members_workspace_id_idx').on(t.workspaceId),
    index('workspace_members_user_id_idx').on(t.userId),
  ],
);

export const terminalAuditLog = pgTable(
  'terminal_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').notNull(),
    command: text('command').notNull(),
    exitCode: integer('exit_code'),
    executedAt: timestamp('executed_at').notNull().defaultNow(),
  },
  (t) => [
    index('terminal_audit_log_workspace_id_idx').on(t.workspaceId),
    index('terminal_audit_log_executed_at_idx').on(t.executedAt),
  ],
);

export type WorkspacePlan = (typeof planEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type ByokKey = typeof byokKeys.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type UserMemory = typeof userMemories.$inferSelect;
export type UserNote = typeof userNotes.$inferSelect;
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type TaskRun = typeof taskRuns.$inferSelect;
export type ResearchJob = typeof researchJobs.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type WorkspaceSettings = typeof workspaceSettings.$inferSelect;
export type MemoryType = (typeof memoryTypeEnum.enumValues)[number];
export type MessageRole = (typeof messageRoleEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
export type TaskTrigger = (typeof taskTriggerEnum.enumValues)[number];
export type TaskType = (typeof taskTypeEnum.enumValues)[number];
export type ResearchStatus = (typeof researchStatusEnum.enumValues)[number];

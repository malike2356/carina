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
  termsAcceptedAt: timestamp('terms_accepted_at'),
  termsVersion: text('terms_version'),
  deletedAt: timestamp('deleted_at'),
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
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
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
    /** Admin/testing: allow Scout pairing without Team plan (GUI toggle). */
    scoutPairingAllowed: boolean('scout_pairing_allowed').notNull().default(false),
    timezone: text('timezone').notNull().default('UTC'),
    activeSkillPacks: text('active_skill_packs').notNull().default(''),
    coreOrgId: uuid('core_org_id'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    currentPeriodEnd: timestamp('current_period_end'),
    onboardingCompletedAt: timestamp('onboarding_completed_at'),
    /**
     * Per-workspace feature overrides. Flat map of feature key -> boolean.
     * Missing key means defer to platform default. Empty object means all defaults.
     */
    featureOverrides: jsonb('feature_overrides').$type<Record<string, boolean>>().notNull().default({}),
    deletedAt: timestamp('deleted_at'),
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
    profileId: uuid('profile_id'),
    lastMessageAt: timestamp('last_message_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('chat_sessions_workspace_id_idx').on(t.workspaceId),
    index('chat_sessions_last_message_at_idx').on(t.lastMessageAt),
    index('chat_sessions_profile_id_idx').on(t.profileId),
  ],
);

export const workspaceProfiles = pgTable(
  'workspace_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    systemPrompt: text('system_prompt'),
    provider: varchar('provider', { length: 50 }),
    model: varchar('model', { length: 120 }),
    isBuiltin: boolean('is_builtin').notNull().default(false),
    builtinId: varchar('builtin_id', { length: 64 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('workspace_profiles_workspace_id_idx').on(t.workspaceId),
    index('workspace_profiles_workspace_slug_idx').on(t.workspaceId, t.slug),
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

export const outreachCampaignStatusEnum = pgEnum('outreach_campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
]);

export const outreachLeadStageEnum = pgEnum('outreach_lead_stage', [
  'prospect',
  'queued',
  'contacted',
  'replied',
  'booked',
  'nurturing',
  'won',
  'lost',
  'unsubscribed',
]);

export const outreachChannelEnum = pgEnum('outreach_channel', [
  'email',
  'whatsapp',
  'sms',
  'phone',
  'telegram',
  'linkedin',
  'manual',
]);

export const outreachDirectionEnum = pgEnum('outreach_direction', ['outbound', 'inbound']);

export const outreachMessageStatusEnum = pgEnum('outreach_message_status', [
  'draft',
  'queued',
  'sent',
  'delivered',
  'failed',
  'replied',
]);

export const outreachTimelineKindEnum = pgEnum('outreach_timeline_kind', [
  'lead_imported',
  'campaign_created',
  'campaign_updated',
  'message_sent',
  'reply_received',
  'booking_created',
  'reminder_created',
  'status_changed',
  'handoff_created',
  'note_added',
]);

export const outreachBookingStatusEnum = pgEnum('outreach_booking_status', [
  'tentative',
  'confirmed',
  'rescheduled',
  'cancelled',
]);

export const outreachReminderStatusEnum = pgEnum('outreach_reminder_status', [
  'scheduled',
  'sent',
  'cancelled',
]);

/** viCal booking status; behavioural parity with Propreneur VcalBooking. */
export const vcalBookingStatusEnum = pgEnum('vcal_booking_status', [
  'pending_payment',
  'pending_review',
  'confirmed',
  'cancelled',
  'rejected',
]);

export const vcalSessionOutcomeEnum = pgEnum('vcal_session_outcome', ['attended', 'no_show']);

export const vcalBookingSourceEnum = pgEnum('vcal_booking_source', [
  'public',
  'api',
  'agent',
  'outreach',
]);

export const vcalLocationModeEnum = pgEnum('vcal_location_mode', [
  'google_meet',
  'zoom',
  'teams',
  'phone',
  'in_person',
  'none',
]);

export const outreachStepKindEnum = pgEnum('outreach_step_kind', [
  'email',
  'whatsapp',
  'sms',
  'phone',
  'wait',
  'manual',
]);

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
    citationStyle: varchar('citation_style', { length: 20 }).notNull().default('apa7'),
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

/** Canonical Document Vault items (prompt 708/710). */
export const documentVaultItems = pgTable(
  'document_vault_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    extension: text('extension'),
    contentAuthority: text('content_authority').notNull().default('workspace'),
    storageLocator: jsonb('storage_locator').$type<Record<string, unknown>>().notNull().default({ scheme: 'inline' }),
    byteSize: integer('byte_size').notNull().default(0),
    checksum: text('checksum').notNull().default(''),
    currentRevision: integer('current_revision').notNull().default(1),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    favorite: boolean('favorite').notNull().default(false),
    trashedAt: timestamp('trashed_at'),
    trashParentId: uuid('trash_parent_id'),
    indexPolicy: text('index_policy').notNull().default('inherit'),
    classification: text('classification').notNull().default('internal'),
    inlineContent: text('inline_content'),
  },
  (t) => [
    index('document_vault_items_ws_parent_idx').on(t.workspaceId, t.parentId, t.trashedAt),
    index('document_vault_items_ws_updated_idx').on(t.workspaceId, t.updatedAt),
  ],
);

export const documentVaultRevisions = pgTable(
  'document_vault_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => documentVaultItems.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull(),
    revision: integer('revision').notNull(),
    checksum: text('checksum').notNull(),
    byteSize: integer('byte_size').notNull(),
    storageLocator: jsonb('storage_locator').$type<Record<string, unknown>>().notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    note: text('note'),
    inlineContent: text('inline_content'),
  },
  (t) => [index('document_vault_revisions_item_idx').on(t.itemId, t.revision)],
);

export const documentVaultLegacyMappings = pgTable(
  'document_vault_legacy_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    legacySource: text('legacy_source').notNull(),
    legacyId: text('legacy_id').notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => documentVaultItems.id, { onDelete: 'cascade' }),
    checksum: text('checksum').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('document_vault_legacy_ws_idx').on(t.workspaceId, t.legacySource, t.legacyId),
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
    toAddress: text('to_address'),
    /** aiva = agent/UI send; google = Gmail import; local = webhook/manual */
    source: varchar('source', { length: 30 }).notNull().default('local'),
    subject: text('subject').notNull().default(''),
    bodyPreview: text('body_preview'),
    bodyFull: text('body_full'),
    /** Gmail (and other) attachment metadata; binaries stay in the provider until download. */
    attachments: jsonb('attachments').$type<Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
    }> | null>(),
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
    index('email_messages_external_id_idx').on(t.externalId),
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
    syncedCalendarIds: jsonb('synced_calendar_ids').$type<string[] | null>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('calendar_connections_workspace_id_idx').on(t.workspaceId)],
);

export const outreachCampaigns = pgTable(
  'outreach_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: outreachCampaignStatusEnum('status').notNull().default('draft'),
    channel: outreachChannelEnum('channel').notNull().default('email'),
    audience: text('audience').notNull().default(''),
    dailyTarget: integer('daily_target').notNull().default(0),
    stopOnReply: boolean('stop_on_reply').notNull().default(true),
    stopOnBooking: boolean('stop_on_booking').notNull().default(true),
    stopOnUnsubscribe: boolean('stop_on_unsubscribe').notNull().default(true),
    launchAt: timestamp('launch_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('outreach_campaigns_workspace_id_idx').on(t.workspaceId),
    index('outreach_campaigns_status_idx').on(t.status),
  ],
);

export const outreachLeads = pgTable(
  'outreach_leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .references(() => outreachCampaigns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    company: text('company'),
    email: text('email'),
    phone: text('phone'),
    channel: outreachChannelEnum('channel').notNull().default('email'),
    stage: outreachLeadStageEnum('stage').notNull().default('prospect'),
    source: text('source').notNull().default('manual'),
    owner: text('owner'),
    lastContactAt: timestamp('last_contact_at'),
    nextFollowUpAt: timestamp('next_follow_up_at'),
    notes: text('notes').notNull().default(''),
    tags: text('tags').array().notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('outreach_leads_workspace_id_idx').on(t.workspaceId),
    index('outreach_leads_campaign_id_idx').on(t.campaignId),
    index('outreach_leads_stage_idx').on(t.stage),
    index('outreach_leads_next_follow_up_idx').on(t.nextFollowUpAt),
  ],
);

export const outreachSequenceSteps = pgTable(
  'outreach_sequence_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(1),
    stepKind: outreachStepKindEnum('step_kind').notNull().default('email'),
    delayMinutes: integer('delay_minutes').notNull().default(0),
    subject: text('subject').notNull().default(''),
    body: text('body').notNull().default(''),
    notes: text('notes').notNull().default(''),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('outreach_sequence_steps_workspace_id_idx').on(t.workspaceId),
    index('outreach_sequence_steps_campaign_id_idx').on(t.campaignId),
  ],
);

export const outreachTimeline = pgTable(
  'outreach_timeline',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .references(() => outreachCampaigns.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .references(() => outreachLeads.id, { onDelete: 'cascade' }),
    kind: outreachTimelineKindEnum('kind').notNull(),
    title: text('title').notNull(),
    detail: text('detail').notNull().default(''),
    direction: outreachDirectionEnum('direction').notNull().default('outbound'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('outreach_timeline_workspace_id_idx').on(t.workspaceId),
    index('outreach_timeline_campaign_id_idx').on(t.campaignId),
    index('outreach_timeline_lead_id_idx').on(t.leadId),
    index('outreach_timeline_created_at_idx').on(t.createdAt),
  ],
);

export const outreachMessages = pgTable(
  'outreach_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .references(() => outreachCampaigns.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => outreachLeads.id, { onDelete: 'cascade' }),
    channel: outreachChannelEnum('channel').notNull().default('email'),
    direction: outreachDirectionEnum('direction').notNull().default('outbound'),
    status: outreachMessageStatusEnum('status').notNull().default('queued'),
    subject: text('subject').notNull().default(''),
    body: text('body').notNull().default(''),
    externalId: text('external_id'),
    sentAt: timestamp('sent_at'),
    receivedAt: timestamp('received_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('outreach_messages_workspace_id_idx').on(t.workspaceId),
    index('outreach_messages_lead_id_idx').on(t.leadId),
    index('outreach_messages_created_at_idx').on(t.createdAt),
  ],
);

export const outreachBookings = pgTable(
  'outreach_bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .references(() => outreachCampaigns.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => outreachLeads.id, { onDelete: 'cascade' }),
    calendarEventId: uuid('calendar_event_id')
      .references(() => calendarEvents.id, { onDelete: 'set null' }),
    status: outreachBookingStatusEnum('status').notNull().default('tentative'),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at'),
    meetingLink: text('meeting_link'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('outreach_bookings_workspace_id_idx').on(t.workspaceId),
    index('outreach_bookings_lead_id_idx').on(t.leadId),
    index('outreach_bookings_starts_at_idx').on(t.startsAt),
  ],
);

export const outreachReminders = pgTable(
  'outreach_reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id')
      .references(() => outreachCampaigns.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => outreachLeads.id, { onDelete: 'cascade' }),
    status: outreachReminderStatusEnum('status').notNull().default('scheduled'),
    channel: outreachChannelEnum('channel').notNull().default('email'),
    reminderAt: timestamp('reminder_at').notNull(),
    message: text('message').notNull().default(''),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('outreach_reminders_workspace_id_idx').on(t.workspaceId),
    index('outreach_reminders_lead_id_idx').on(t.leadId),
    index('outreach_reminders_reminder_at_idx').on(t.reminderAt),
  ],
);

/**
 * viCal (Verlox Integrated Calendar) workspace booking tables.
 * Behavioural source: propreneur-v2 Vcal_* / vcal_*; Core runtime may use file store until cutover.
 */
export const vcalEventTypes = pgTable(
  'vcal_event_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    hostUserId: text('host_user_id').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    bufferBeforeMinutes: integer('buffer_before_minutes').notNull().default(0),
    bufferAfterMinutes: integer('buffer_after_minutes').notNull().default(0),
    minNoticeMinutes: integer('min_notice_minutes').notNull().default(120),
    horizonDays: integer('horizon_days').notNull().default(14),
    locationMode: vcalLocationModeEnum('location_mode').notNull().default('google_meet'),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    requiresDeposit: boolean('requires_deposit').notNull().default(false),
    depositMinor: integer('deposit_minor'),
    depositCurrency: varchar('deposit_currency', { length: 8 }),
    intakePoolId: uuid('intake_pool_id'),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('vcal_event_types_workspace_id_idx').on(t.workspaceId),
    index('vcal_event_types_workspace_slug_idx').on(t.workspaceId, t.slug),
  ],
);

export const vcalAvailabilityRules = pgTable(
  'vcal_availability_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    hostUserId: text('host_user_id').notNull(),
    eventTypeId: uuid('event_type_id').references(() => vcalEventTypes.id, { onDelete: 'set null' }),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: varchar('start_time', { length: 8 }).notNull(),
    endTime: varchar('end_time', { length: 8 }).notNull(),
    timezone: text('timezone').notNull().default('Europe/London'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('vcal_availability_rules_workspace_id_idx').on(t.workspaceId),
    index('vcal_availability_rules_host_idx').on(t.workspaceId, t.hostUserId),
  ],
);

export const vcalBlackoutDates = pgTable(
  'vcal_blackout_dates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    hostUserId: text('host_user_id'),
    startsOn: text('starts_on').notNull(),
    endsOn: text('ends_on').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('vcal_blackout_dates_workspace_id_idx').on(t.workspaceId)],
);

export const vcalBookings = pgTable(
  'vcal_bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    eventTypeId: uuid('event_type_id')
      .notNull()
      .references(() => vcalEventTypes.id, { onDelete: 'cascade' }),
    hostUserId: text('host_user_id').notNull(),
    guestName: text('guest_name').notNull(),
    guestEmail: text('guest_email').notNull(),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    timezone: text('timezone').notNull().default('Europe/London'),
    status: vcalBookingStatusEnum('status').notNull().default('confirmed'),
    guestToken: text('guest_token').notNull().unique(),
    meetingUrl: text('meeting_url'),
    calendarEventId: text('calendar_event_id'),
    contactId: text('contact_id'),
    leadId: text('lead_id'),
    source: vcalBookingSourceEnum('source').notNull().default('api'),
    intakeAnswers: jsonb('intake_answers').$type<Record<string, unknown>>(),
    notes: text('notes'),
    sessionOutcome: vcalSessionOutcomeEnum('session_outcome'),
    cancelReason: text('cancel_reason'),
    previousStartsAt: timestamp('previous_starts_at'),
    previousEndsAt: timestamp('previous_ends_at'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('vcal_bookings_workspace_id_idx').on(t.workspaceId),
    index('vcal_bookings_workspace_host_starts_idx').on(t.workspaceId, t.hostUserId, t.startsAt),
    index('vcal_bookings_guest_email_idx').on(t.workspaceId, t.guestEmail),
    index('vcal_bookings_lead_id_idx').on(t.leadId),
  ],
);

export const vcalSlotLocks = pgTable(
  'vcal_slot_locks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    hostUserId: text('host_user_id').notNull(),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    holderToken: text('holder_token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('vcal_slot_locks_workspace_host_idx').on(t.workspaceId, t.hostUserId),
    index('vcal_slot_locks_expires_at_idx').on(t.expiresAt),
  ],
);

export const workspaceSettings = pgTable('workspace_settings', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  inboundEmailToken: text('inbound_email_token'),
  theme: varchar('theme', { length: 30 }).notNull().default('dark'),
  customTheme: jsonb('custom_theme'),
  appearance: jsonb('appearance'),
  brand: jsonb('brand').notNull().default({}),
  packCatalog: jsonb('pack_catalog').notNull().default([]),
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

export const customDomains = pgTable(
  'custom_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    hostname: text('hostname').notNull().unique(),
    verificationToken: text('verification_token').notNull(),
    verifiedAt: timestamp('verified_at'),
    tlsStatus: varchar('tls_status', { length: 20 }).notNull().default('pending'),
    isCanonical: boolean('is_canonical').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('custom_domains_workspace_id_idx').on(t.workspaceId),
    index('custom_domains_hostname_idx').on(t.hostname),
  ],
);

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

export const ssoProviderTypeEnum = pgEnum('sso_provider_type', ['oidc', 'saml']);

export const workspaceSsoProviders = pgTable(
  'workspace_sso_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    providerType: ssoProviderTypeEnum('provider_type').notNull().default('oidc'),
    displayName: text('display_name').notNull(),
    domain: varchar('domain', { length: 255 }).notNull(),
    issuer: text('issuer'),
    clientId: text('client_id'),
    clientSecretEnc: text('client_secret_enc'),
    clientSecretIv: text('client_secret_iv'),
    clientSecretTag: text('client_secret_tag'),
    samlEntityId: text('saml_entity_id'),
    samlSsoUrl: text('saml_sso_url'),
    samlCertificateEnc: text('saml_certificate_enc'),
    samlCertificateIv: text('saml_certificate_iv'),
    samlCertificateTag: text('saml_certificate_tag'),
    defaultRole: varchar('default_role', { length: 30 }).notNull().default('member'),
    ssoRequired: boolean('sso_required').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('workspace_sso_providers_workspace_id_idx').on(t.workspaceId),
    index('workspace_sso_providers_domain_idx').on(t.domain),
  ],
);

export type WorkspaceSsoProvider = typeof workspaceSsoProviders.$inferSelect;
export type SsoProviderType = (typeof ssoProviderTypeEnum.enumValues)[number];

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

export const legalDocuments = pgTable(
  'legal_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentType: text('document_type').notNull(),
    version: text('version').notNull(),
    effectiveDate: text('effective_date').notNull(),
    contentUrl: text('content_url').notNull(),
    isCurrent: boolean('is_current').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('legal_documents_type_version_idx').on(t.documentType, t.version)],
);

export const legalAcceptances = pgTable(
  'legal_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    documentType: text('document_type').notNull(),
    documentVersion: text('document_version').notNull(),
    acceptedAt: timestamp('accepted_at').notNull().defaultNow(),
    ipAddressHash: text('ip_address_hash'),
    userAgent: text('user_agent'),
  },
  (t) => [
    index('legal_acceptances_user_document_idx').on(t.userId, t.documentType),
    index('legal_acceptances_workspace_accepted_idx').on(t.workspaceId, t.acceptedAt),
  ],
);

export type LegalDocument = typeof legalDocuments.$inferSelect;
export type LegalAcceptance = typeof legalAcceptances.$inferSelect;

export type WorkspacePlan = (typeof planEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type ByokKey = typeof byokKeys.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type WorkspaceProfile = typeof workspaceProfiles.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type UserMemory = typeof userMemories.$inferSelect;
export type UserNote = typeof userNotes.$inferSelect;
export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;
export type OutreachLead = typeof outreachLeads.$inferSelect;
export type OutreachSequenceStep = typeof outreachSequenceSteps.$inferSelect;
export type OutreachTimelineEntry = typeof outreachTimeline.$inferSelect;
export type OutreachMessage = typeof outreachMessages.$inferSelect;
export type OutreachBooking = typeof outreachBookings.$inferSelect;
export type OutreachReminder = typeof outreachReminders.$inferSelect;
export type VcalEventType = typeof vcalEventTypes.$inferSelect;
export type VcalAvailabilityRule = typeof vcalAvailabilityRules.$inferSelect;
export type VcalBlackoutDate = typeof vcalBlackoutDates.$inferSelect;
export type VcalBooking = typeof vcalBookings.$inferSelect;
export type VcalSlotLock = typeof vcalSlotLocks.$inferSelect;
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type TaskRun = typeof taskRuns.$inferSelect;
export type ResearchJob = typeof researchJobs.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentVaultItem = typeof documentVaultItems.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type WorkspaceSettings = typeof workspaceSettings.$inferSelect;
export type MemoryType = (typeof memoryTypeEnum.enumValues)[number];
export type OutreachCampaignStatus = (typeof outreachCampaignStatusEnum.enumValues)[number];
export type OutreachLeadStage = (typeof outreachLeadStageEnum.enumValues)[number];
export type OutreachChannel = (typeof outreachChannelEnum.enumValues)[number];
export type OutreachDirection = (typeof outreachDirectionEnum.enumValues)[number];
export type OutreachMessageStatus = (typeof outreachMessageStatusEnum.enumValues)[number];
export type OutreachTimelineKind = (typeof outreachTimelineKindEnum.enumValues)[number];
export type OutreachBookingStatus = (typeof outreachBookingStatusEnum.enumValues)[number];
export type OutreachReminderStatus = (typeof outreachReminderStatusEnum.enumValues)[number];
export type OutreachStepKind = (typeof outreachStepKindEnum.enumValues)[number];
export type MessageRole = (typeof messageRoleEnum.enumValues)[number];
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number];
export type TaskTrigger = (typeof taskTriggerEnum.enumValues)[number];
export type TaskType = (typeof taskTypeEnum.enumValues)[number];
export type ResearchStatus = (typeof researchStatusEnum.enumValues)[number];

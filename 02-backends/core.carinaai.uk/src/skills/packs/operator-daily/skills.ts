import type { PackSkillInput } from '../../pack-types.js';

export const operatorDailySkills: PackSkillInput[] = [
  {
    name: 'memory-consolidation',
    description: 'Review recent notes and merge durable facts into long-term memory',
    trigger: ['consolidate memory', 'review memory', 'update memory file', 'memory maintenance'],
    steps: `1. session-search for recent topics worth keeping.
2. memory list for user and agent targets; remove duplicates.
3. notes-manage list for open tasks and reminders to carry forward.
4. Add concise facts via memory add; replace outdated lines via memory replace.
5. Do not paste raw chat logs into memory; distill only reusable facts.`,
    toolsUsed: ['session-search', 'memory', 'notes-manage'],
  },
  {
    name: 'workspace-notes-tasks',
    description: 'Manage notes, tasks, and reminders in the /notes workspace',
    trigger: ['add a task', 'remind me', 'notes workspace', 'todo list', 'mark task done'],
    steps: `1. todo for in-session steps; notes-manage for persistent workspace items.
2. notes-manage create with format task or reminder; set remind_at ISO time for reminders.
3. notes-manage list with format filter; update done=true when complete.
4. Keep titles short; put detail in body.`,
    toolsUsed: ['todo', 'notes-manage'],
  },
  {
    name: 'workspace-documents',
    description: 'Create and maintain documents in the /documents workspace',
    trigger: ['write a document', 'save as markdown', 'documents workspace', 'draft doc'],
    steps: `1. documents-manage list to avoid duplicates.
2. documents-manage create with format markdown unless user needs html/csv.
3. documents-manage update for revisions; get before large edits.
4. Return document id and title to the user.`,
    toolsUsed: ['documents-manage', 'file-read', 'file-write'],
  },
  {
    name: 'image-gallery-workflow',
    description: 'Generate images and manage the persistent /images gallery',
    trigger: [
      'gallery',
      'save this image',
      'list generated images',
      'delete image',
      'generate image',
      'welcome banner',
      'create banner',
      'marketing graphic',
    ],
    steps: `1. image-generation creates and persists to the gallery automatically.
2. images-gallery list with pagination; get for metadata.
3. images-gallery delete only when user confirms.
4. Return gallery url paths from list/get responses.`,
    toolsUsed: ['image-generation', 'images-gallery'],
  },
  {
    name: 'secrets-hygiene',
    description: 'Audit local env for placeholder secrets and precedence drift',
    trigger: ['secrets audit', 'check api keys', 'env hygiene', 'placeholder keys'],
    steps: `1. Run secrets-audit tool (read-only; never prints secret values).
2. Summarize fail/warn counts and unresolved env refs.
3. Point operator to carina secrets audit CLI for full report.
4. Never commit or echo real secret values.`,
    toolsUsed: ['secrets-audit'],
  },
  {
    name: 'backup-restore',
    description: 'Create and verify Carina backups before risky changes',
    trigger: ['backup carina', 'restore backup', 'snapshot config', 'disaster recovery'],
    steps: `1. shell-exec: carina backup create (or carina ops backup create).
2. carina backup verify on latest archive before restore.
3. checkpoint-manager for workspace snapshots before large edits.
4. Confirm with user before restore --force.`,
    toolsUsed: ['shell-exec', 'checkpoint-manager'],
  },
  {
    name: 'linear-issues',
    description: 'Create and triage Linear issues via API',
    trigger: ['linear', 'linear issue', 'create ticket linear', 'triage linear'],
    steps: `1. Confirm LINEAR_API_KEY is set in env.
2. http-request to api.linear.app/graphql with Bearer token.
3. Create issues with team id, title, description; query open issues by label.
4. Never ask user to paste API keys in chat.`,
    toolsUsed: ['http-request'],
  },
  {
    name: 'scheduled-voice-briefing',
    description: 'Schedule a recurring spoken briefing via cron and TTS',
    trigger: ['voice briefing', 'morning briefing audio', 'spoken summary daily', 'schedule tts'],
    steps: `1. Draft a self-contained briefing prompt (weather, tasks, calendar if configured).
2. cronjob create with deliver channel (telegram, web, etc.).
3. text-to-speech for one-off audio; cron for recurring.
4. Confirm schedule timezone with user.`,
    toolsUsed: ['cronjob', 'text-to-speech', 'notes-manage', 'http-request'],
  },
  {
    name: 'mcp-server-connect',
    description: 'Connect external MCP tool servers safely',
    trigger: ['mcp server', 'connect mcp', 'model context protocol', 'add mcp tools'],
    steps: `1. mcp tool with action connect; prefer stdio for local servers.
2. Document server name and allowed tools after list.
3. Never connect unreviewed servers on production without operator approval.
4. Use toolsets mcp preset for channel exposure.`,
    toolsUsed: ['mcp'],
  },
  {
    name: 'inbound-email-triage',
    description: 'Triage inbound email and link actions to workspace',
    trigger: ['triage email', 'inbox review', 'urgent email', 'email triage'],
    steps: `1. email-list for recent inbound messages.
2. Flag urgency; suggest notes-manage tasks for follow-ups.
3. For outbound replies use email-send or email-smtp-send after confirmation.
4. Do not expose full headers with secrets.`,
    toolsUsed: ['email-list', 'notes-manage', 'email-send'],
  },
  {
    name: 'session-handoff',
    description: 'Produce a handoff summary for the next session or subagent',
    trigger: ['handoff', 'continue tomorrow', 'pick up where we left off', 'session summary'],
    steps: `1. session-search for this thread topic if needed.
2. Summarize: goal, decisions, open tasks, file paths, blockers.
3. notes-manage create format note with title "Handoff YYYY-MM-DD".
4. memory add only for durable preferences, not transient state.`,
    toolsUsed: ['session-search', 'notes-manage', 'memory'],
  },
  {
    name: 'auto-skill-review',
    description: 'Review auto-learned skills and promote or refine drafts',
    trigger: ['review learned skills', 'skill drafts', 'promote skill', 'learning loop'],
    steps: `1. skills-list; filter status draft or source learning-loop.
2. skill-view before edits; skill-manage update to promote or merge triggers.
3. Prefer refining existing skills over creating duplicates.
4. Run curator on schedule; do not delete skills, archive only.`,
    toolsUsed: ['skills-list', 'skill-view', 'skill-manage', 'skill-curator'],
  },
];

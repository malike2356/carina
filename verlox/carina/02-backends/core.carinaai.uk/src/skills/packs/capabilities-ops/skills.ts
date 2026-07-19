import type { PackSkillInput } from '../../pack-types.js';

export const capabilitiesOpsSkills: PackSkillInput[] = [
  {
    name: 'capability-audit',
    description: 'Run a tools/skills/channels gap audit for the operator',
    trigger: ['capability audit', 'how many tools', 'channel count', 'skill inventory'],
    steps: `1. capabilities-audit tool or carina capabilities audit.
2. Summarize registered tools, curated skills, and channel catalog size vs targets.
3. Highlight gaps and missing metadata if any.
4. Point to carina capabilities gaps --json for automation.`,
    toolsUsed: ['capabilities-audit'],
  },
  {
    name: 'channel-health-review',
    description: 'Review channel adapter configuration and health states',
    trigger: ['channel health', 'which channels are connected', 'channel status'],
    steps: `1. channel-status-snapshot or carina channels status.
2. Group by connected, partial, disabled.
3. For partial channels, list missing env keys from reason text.
4. Suggest carina channels setup <name> for configuration steps.`,
    toolsUsed: ['channel-status-snapshot'],
  },
  {
    name: 'json-cleanup',
    description: 'Validate and pretty-print JSON API responses',
    trigger: ['format json', 'pretty print json', 'validate json'],
    steps: `1. json-format validate then pretty with indent 2.
2. Return formatted block to user; do not mutate files unless asked.
3. For large payloads, truncate in chat and offer file-write.`,
    toolsUsed: ['json-format'],
  },
  {
    name: 'cron-schedule-design',
    description: 'Design and validate cron schedules for recurring jobs',
    trigger: ['cron schedule', 'every morning at', 'validate cron'],
    steps: `1. For Aiva/Telegram users, prefer worker-automation with hour/minute + timezone (Europe/London default). Skip cron-expression confirmation.
2. Only use cron-explain + host cronjob for operator/host sessions that need raw cron validation.
3. After create, confirm with worker-automation list (or cronjob list on host).`,
    toolsUsed: ['worker-automation', 'cron-explain', 'cronjob'],
  },
  {
    name: 'rss-monitoring',
    description: 'Monitor RSS feeds for news and research alerts',
    trigger: ['rss feed', 'atom feed', 'feed reader'],
    steps: `1. rss-fetch with limit 10.
2. Summarize new items; link titles.
3. notes-manage task for follow-ups when user wants tracking.`,
    toolsUsed: ['rss-fetch', 'notes-manage'],
  },
  {
    name: 'research-library',
    description: 'Browse saved deep-research reports',
    trigger: ['saved research', 'research reports', 'list research'],
    steps: `1. research-list with sensible limit.
2. Offer shareId and title for follow-up.
3. carina research show <id> for full text when user picks one.`,
    toolsUsed: ['research-list'],
  },
  {
    name: 'learning-loop-check',
    description: 'Check self-improvement loop and draft skill backlog',
    trigger: ['learning status', 'skill drafts pending', 'curator status'],
    steps: `1. learning-status for metrics.
2. carina learning pending for detail if DB available.
3. Recommend curator run when drafts pile up.`,
    toolsUsed: ['learning-status', 'skill-curator'],
  },
  {
    name: 'env-config-check',
    description: 'Verify required env keys are present before enabling integrations',
    trigger: ['check env keys', 'is api key set', 'env configured'],
    steps: `1. env-presence for the integration env list (names only).
2. secrets-audit for placeholder hygiene.
3. Never print secret values.`,
    toolsUsed: ['env-presence', 'secrets-audit'],
  },
  {
    name: 'semver-release-compare',
    description: 'Compare package or image versions before upgrades',
    trigger: ['which version is newer', 'semver compare', 'upgrade version'],
    steps: `1. semver-compare left/right versions.
2. Summarize equal vs newer side.
3. git-brief-status if repo upgrade in progress.`,
    toolsUsed: ['semver-compare', 'git-brief-status'],
  },
  {
    name: 'diff-review',
    description: 'Review text diffs for config or prompt changes',
    trigger: ['diff these', 'what changed', 'compare text'],
    steps: `1. text-diff before/after blobs.
2. Summarize added/removed/changed counts.
3. Offer patch or file-write only after confirmation.`,
    toolsUsed: ['text-diff'],
  },
  {
    name: 'slug-and-id-generation',
    description: 'Generate slugs, UUIDs, and random tokens safely',
    trigger: ['generate uuid', 'random token', 'slugify'],
    steps: `1. uuid-generate or random-string as needed.
2. slugify-text for URLs and filenames.
3. Never reuse tokens across tenants.`,
    toolsUsed: ['uuid-generate', 'random-string', 'slugify-text'],
  },
  {
    name: 'yaml-config-convert',
    description: 'Convert between YAML and JSON for config edits',
    trigger: ['yaml to json', 'json to yaml', 'convert config'],
    steps: `1. yaml-json-convert with direction.
2. Validate with json-format if converting to JSON.
3. file-write only after user confirms path.`,
    toolsUsed: ['yaml-json-convert', 'json-format', 'file-read'],
  },
  {
    name: 'markdown-plain-export',
    description: 'Strip markdown for SMS, TTS, or plain email',
    trigger: ['plain text version', 'strip markdown', 'tts script'],
    steps: `1. markdown-to-text on source.
2. Truncate to channel max length using channel-status if sending externally.
3. text-to-speech for audio when requested.`,
    toolsUsed: ['markdown-to-text', 'text-to-speech'],
  },
  {
    name: 'url-inspection',
    description: 'Parse URLs and query strings for debugging webhooks',
    trigger: ['parse this url', 'query params', 'break down url'],
    steps: `1. url-parse action parse.
2. List query keys; flag missing protocol/host.
3. http-request only with operator approval.`,
    toolsUsed: ['url-parse'],
  },
  {
    name: 'unit-quick-convert',
    description: 'Convert bytes, temperature, and distance for reports',
    trigger: ['convert mb to gb', 'celsius to fahrenheit', 'miles to km'],
    steps: `1. unit-convert with kind/from/to.
2. Round sensibly for display.
3. Include original value in summary.`,
    toolsUsed: ['unit-convert'],
  },
  {
    name: 'csv-snapshot-parse',
    description: 'Parse small CSV exports for quick analysis',
    trigger: ['parse csv', 'csv rows', 'spreadsheet paste'],
    steps: `1. csv-parse with delimiter if not comma.
2. Summarize row count and header.
3. documents-manage create if user wants to save table.`,
    toolsUsed: ['csv-parse', 'documents-manage'],
  },
  {
    name: 'disk-footprint-check',
    description: 'Check local directory size before backup or ingest',
    trigger: ['how big is folder', 'disk usage', 'directory size'],
    steps: `1. disk-usage on path.
2. Warn if walk may be slow on large trees.
3. backup create before destructive operations.`,
    toolsUsed: ['disk-usage'],
  },
  {
    name: 'git-working-tree-triage',
    description: 'Quick git status before commits or deploys',
    trigger: ['git status', 'what files changed', 'branch name'],
    steps: `1. git-brief-status on repo path.
2. Summarize branch and changed file count.
3. shell-exec for full diff only when user asks.`,
    toolsUsed: ['git-brief-status'],
  },
  {
    name: 'thread-ownership-handoff',
    description: 'Hand off multi-channel thread ownership between agents',
    trigger: ['handoff thread', 'release thread ownership', 'who owns this thread'],
    steps: `1. Confirm CARINA_THREAD_OWNERSHIP=true.
2. carina channels threads list for active ownership.
3. carina channels threads handoff with target agent after user confirms.`,
    toolsUsed: ['channel-status-snapshot'],
  },
  {
    name: 'webhook-channel-onboard',
    description: 'Onboard webhook-stub catalog channels (ntfy, zulip, rocketchat, etc.)',
    trigger: ['setup ntfy', 'webhook channel', 'catalog channel'],
    steps: `1. channel-status-snapshot; find catalog channel state.
2. carina channels setup <name> for env checklist.
3. Document inbound webhook path; test with http-request POST only when operator approves.`,
    toolsUsed: ['channel-status-snapshot', 'http-request'],
  },
];

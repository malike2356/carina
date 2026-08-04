import type { PackSkillInput } from '../property-uk/skills.js';

export const socialExtendedSkills: PackSkillInput[] = [
  {
    name: 'xurl-posting',
    description: 'Draft and post to X/Twitter when API credentials exist',
    trigger: ['post tweet', 'x post', 'twitter post', 'xurl'],
    steps: '1. Draft post text within limits.\n2. Use x-post after user confirmation.\n3. Return post URL if available.',
    toolsUsed: ['x-post', 'x-search'],
  },
  {
    name: 'discord-community',
    description: 'Moderate and manage Discord communities',
    trigger: ['discord admin', 'discord server', 'pin message', 'discord thread'],
    steps: '1. Use discord-admin for channels/members.\n2. Confirm destructive actions.\n3. Use discord tool for announcements.',
    toolsUsed: ['discord-admin', 'discord'],
  },
  {
    name: 'slack-standup',
    description: 'Collect and post standup updates in Slack',
    trigger: ['slack standup', 'daily standup', 'team update slack'],
    steps: '1. Gather updates from user.\n2. Format concise standup.\n3. send-message to Slack channel.',
    toolsUsed: ['send-message'],
  },
  {
    name: 'feishu-announce',
    description: 'Post announcements to Feishu/Lark chats',
    trigger: ['feishu announce', 'lark message', 'feishu chat'],
    steps: '1. Draft announcement.\n2. send-message channel=feishu.\n3. Attach doc link via feishu-doc if needed.',
    toolsUsed: ['send-message', 'feishu-doc'],
  },
  {
    name: 'social-listening',
    description: 'Monitor brand mentions across X and web',
    trigger: ['social listening', 'brand mentions', 'reputation monitor'],
    steps: '1. x-search for brand terms.\n2. web-search for broader mentions.\n3. Summarize sentiment themes.',
    toolsUsed: ['x-search', 'web-search'],
  },
  {
    name: 'matrix-room-bot',
    description: 'Interact with Matrix rooms via gateway',
    trigger: ['matrix room', 'matrix bot', 'element chat'],
    steps: '1. Confirm MATRIX_* env configured.\n2. Use send-message channel=matrix.\n3. Keep messages concise.',
    toolsUsed: ['send-message'],
  },
];

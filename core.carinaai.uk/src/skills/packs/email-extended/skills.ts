import type { PackSkillInput } from '../../pack-types.js';

export const emailExtendedSkills: PackSkillInput[] = [
  {
    name: 'himalaya-cli',
    description: 'Manage email via Himalaya CLI when installed',
    trigger: ['himalaya', 'cli email', 'imap inbox', 'mail client'],
    steps: '1. Check himalaya via shell-exec.\n2. List/read/send using configured account.\n3. Never echo passwords.',
    toolsUsed: ['shell-exec', 'email-list', 'email-send'],
  },
  {
    name: 'inbox-triage',
    description: 'Triage inbox and draft replies',
    trigger: ['inbox triage', 'unread email', 'prioritize email'],
    steps: '1. Use email-list.\n2. Classify urgency.\n3. Draft replies; confirm before email-send.',
    toolsUsed: ['email-list', 'email-send'],
  },
  {
    name: 'email-templates',
    description: 'Reusable email templates for outreach',
    trigger: ['email template', 'outreach email', 'follow up email'],
    steps: '1. Ask for tone and goal.\n2. Draft template with placeholders.\n3. Save to resources if requested.',
    toolsUsed: ['file-write', 'email-send'],
  },
  {
    name: 'newsletter-digest',
    description: 'Summarize newsletter threads into a digest',
    trigger: ['newsletter digest', 'email summary', 'weekly digest'],
    steps: '1. Pull recent messages via email-list.\n2. Cluster by topic.\n3. Output bullet digest.',
    toolsUsed: ['email-list'],
  },
  {
    name: 'email-channel-reply',
    description: 'Reply via full email channel gateway',
    trigger: ['email channel', 'reply by email', 'inbound email'],
    steps: '1. Parse inbound context.\n2. Use send-message channel=email or email-send.\n3. Keep thread subject.',
    toolsUsed: ['send-message', 'email-send'],
  },
];

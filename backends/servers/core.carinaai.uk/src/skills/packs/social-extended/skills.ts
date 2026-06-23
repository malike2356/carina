import type { PackSkillInput } from '../../pack-types.js';

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
  {
    name: 'whatsapp-enquiry',
    description: 'Handle inbound WhatsApp enquiries: qualify the request, draft a response, and escalate if needed',
    trigger: ['whatsapp enquiry', 'whatsapp reply', 'whatsapp message', 'wa enquiry', 'whatsapp inbound'],
    steps: `1. Accept the inbound WhatsApp message content from the user or channel gateway.
2. Classify the enquiry: product question, booking request, complaint, general info, or spam.
3. For product/booking questions: draft a concise, friendly reply covering the specific question. Ask one clarifying question if intent is unclear.
4. For complaints: acknowledge empathetically, ask for details if missing, and offer a resolution path. Escalate if the complaint involves financial claims.
5. For spam: draft a polite decline or recommend ignoring.
6. Confirm the draft before sending via send-message channel=whatsapp.
7. Keep replies to 3-5 sentences; WhatsApp users expect concise responses.`,
    toolsUsed: ['send-message'],
  },
  {
    name: 'telegram-alert',
    description: 'Send structured alert or notification messages to a Telegram channel or chat',
    trigger: ['telegram alert', 'telegram notify', 'telegram message', 'send telegram', 'telegram bot'],
    steps: `1. Ask for the message content, urgency level (info, warning, critical), and target chat or channel.
2. Format with a clear header: [INFO], [WARNING], or [CRITICAL] followed by the message body.
3. Keep messages under 4096 characters. If longer, split into logical chunks.
4. Confirm the draft before sending.
5. Send via send-message channel=telegram.
6. Confirm with message timestamp after sending.`,
    toolsUsed: ['send-message'],
  },
];

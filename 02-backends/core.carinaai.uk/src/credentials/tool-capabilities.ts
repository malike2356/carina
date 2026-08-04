export interface ToolCapabilityEntry {
  tool_name: string;
  description: string;
  required_credentials: string[];
  category: string;
  hide_when_unconfigured?: boolean;
}

export const TOOL_CAPABILITIES: ToolCapabilityEntry[] = [
  // Search
  {
    tool_name: 'web_search_tavily',
    description: 'Web search via Tavily API',
    required_credentials: ['TAVILY_API_KEY'],
    category: 'search',
  },

  // AI Providers
  {
    tool_name: 'chat_anthropic',
    description: 'Claude chat via Anthropic API',
    required_credentials: ['ANTHROPIC_API_KEY'],
    category: 'ai-providers',
  },
  {
    tool_name: 'chat_openai',
    description: 'GPT chat via OpenAI API',
    required_credentials: ['OPENAI_API_KEY'],
    category: 'ai-providers',
  },
  {
    tool_name: 'chat_deepseek',
    description: 'DeepSeek chat',
    required_credentials: ['DEEPSEEK_API_KEY'],
    category: 'ai-providers',
  },
  {
    tool_name: 'chat_gemini',
    description: 'Gemini chat via Google AI API',
    required_credentials: ['GEMINI_API_KEY'],
    category: 'ai-providers',
  },

  // Messaging
  {
    tool_name: 'email_smtp_send',
    description: 'Send email via SMTP (or Resend SMTP when RESEND_API_KEY is set)',
    required_credentials: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
    category: 'messaging',
  },
  {
    tool_name: 'email-send',
    description: 'Send email via Resend API',
    required_credentials: ['RESEND_API_KEY'],
    category: 'messaging',
  },
  {
    tool_name: 'gmail-send',
    description: 'Send email via connected Gmail for this worker',
    required_credentials: [],
    category: 'messaging',
  },
  {
    tool_name: 'email_imap_read',
    description: 'Read email via IMAP',
    required_credentials: ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASS'],
    category: 'messaging',
  },

  // Payments
  {
    tool_name: 'stripe_billing',
    description: 'Process payments via Stripe',
    required_credentials: ['STRIPE_SECRET_KEY'],
    category: 'payments',
  },

  // Media
  {
    tool_name: 'text_to_speech',
    description: 'Generate voice audio',
    required_credentials: [],
    category: 'media',
  },

  // Security
  {
    tool_name: 'scout_govern',
    description: 'Scout security governance',
    required_credentials: ['SCOUT_API_KEY'],
    category: 'security',
  },

  // Integrations
  {
    tool_name: 'notion_api',
    description: 'Notion workspace integration',
    required_credentials: ['NOTION_API_KEY'],
    category: 'integrations',
    hide_when_unconfigured: true,
  },
  {
    tool_name: 'github_api',
    description: 'GitHub API access',
    required_credentials: ['GITHUB_TOKEN'],
    category: 'integrations',
    hide_when_unconfigured: true,
  },
  {
    tool_name: 'google_workspace',
    description: 'Google Workspace (Gmail, Calendar, Drive)',
    required_credentials: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
    category: 'integrations',
    hide_when_unconfigured: true,
  },
  {
    tool_name: 'resend_email',
    description: 'Transactional email via Resend',
    required_credentials: ['RESEND_API_KEY'],
    category: 'messaging',
  },
  {
    tool_name: 'telegram_gateway',
    description: 'Telegram bot messaging',
    required_credentials: ['TELEGRAM_BOT_TOKEN'],
    category: 'messaging',
    hide_when_unconfigured: true,
  },
];

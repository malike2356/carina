export type ConfigStorageMode = 'db' | 'env';

export interface ConfigField {
  key: string;
  label: string;
  description?: string;
  sensitive: boolean;
  optional: boolean;
  example?: string;
  envVar?: string;
  validValues?: string[];
}

export interface ConfigDomain {
  id: string;
  name: string;
  aliases: string[];
  description?: string;
  fields: ConfigField[];
  storageMode: ConfigStorageMode;
  requiresRestart?: boolean;
  setupDocs?: string;
}

export const DOMAIN_CATEGORY_LABELS: Record<string, string> = {
  provider: 'AI providers',
  workspace: 'Workspace',
  integration: 'Integrations',
  scout: 'Scout security',
  voice: 'Voice',
  model: 'Models',
  device: 'Devices',
  search: 'Search',
};

function field(
  key: string,
  label: string,
  options: Partial<Omit<ConfigField, 'key' | 'label'>> = {},
): ConfigField {
  return {
    key,
    label,
    sensitive: options.sensitive ?? false,
    optional: options.optional ?? false,
    ...options,
    envVar: options.envVar ?? key,
  };
}

function domain(
  id: string,
  name: string,
  aliases: string[],
  fields: ConfigField[],
  options: Partial<Omit<ConfigDomain, 'id' | 'name' | 'aliases' | 'fields'>> = {},
): ConfigDomain {
  return {
    id,
    name,
    aliases,
    fields,
    storageMode: options.storageMode ?? 'env',
    ...options,
  };
}

const apiKey = (key: string, label: string): ConfigField =>
  field(key, label, { sensitive: true, example: 'your-api-key' });

export const ALL_CONFIG_DOMAINS: ConfigDomain[] = [
  domain('provider:openai', 'OpenAI', ['openai', 'gpt', 'gpt-4', 'chatgpt'], [
    apiKey('OPENAI_API_KEY', 'OpenAI API key'),
  ], { requiresRestart: true }),
  domain('provider:anthropic', 'Anthropic', ['anthropic', 'claude'], [
    apiKey('ANTHROPIC_API_KEY', 'Anthropic API key'),
  ], { requiresRestart: true }),
  domain('provider:deepseek', 'DeepSeek', ['deepseek'], [
    apiKey('DEEPSEEK_API_KEY', 'DeepSeek API key'),
  ], { requiresRestart: true }),
  domain('provider:gemini', 'Google Gemini', ['gemini', 'google ai'], [
    apiKey('GEMINI_API_KEY', 'Gemini API key'),
  ], { requiresRestart: true }),
  domain('provider:groq', 'Groq', ['groq'], [
    apiKey('GROQ_API_KEY', 'Groq API key'),
  ], { requiresRestart: true }),
  domain('provider:ollama', 'Ollama', ['ollama', 'local models'], [
    field('OLLAMA_BASE_URL', 'Ollama base URL', { example: 'http://127.0.0.1:11434' }),
  ]),
  domain('provider:tavily', 'Tavily', ['tavily'], [
    apiKey('TAVILY_API_KEY', 'Tavily API key'),
  ], { requiresRestart: true }),
  domain('provider:mistral', 'Mistral', ['mistral'], [
    apiKey('MISTRAL_API_KEY', 'Mistral API key'),
  ], { requiresRestart: true }),
  domain('provider:openrouter', 'OpenRouter', ['openrouter'], [
    apiKey('OPENROUTER_API_KEY', 'OpenRouter API key'),
  ], { requiresRestart: true }),
  domain('workspace:timezone', 'Workspace timezone', ['timezone', 'time zone'], [
    field('WORKSPACE_TIMEZONE', 'IANA timezone', { example: 'Europe/London' }),
  ], { storageMode: 'db' }),
  domain('workspace:quiet-hours', 'Quiet hours', ['quiet hours', 'quiet time'], [
    field('WORKSPACE_QUIET_HOURS', 'Quiet-hours range', { example: '22:00-07:00' }),
  ], { storageMode: 'db' }),
  domain('workspace:language', 'Workspace language', ['language', 'locale'], [
    field('WORKSPACE_LANGUAGE', 'Language', { example: 'en-GB' }),
  ], { storageMode: 'db' }),
  domain('integration:n8n', 'n8n', ['n8n', 'automation'], [
    field('N8N_WEBHOOK_URL', 'n8n webhook URL', { example: 'https://n8n.example.com/webhook/carina' }),
  ]),
  domain('integration:trello', 'Trello', ['trello'], [
    apiKey('TRELLO_API_KEY', 'Trello API key'),
    field('TRELLO_TOKEN', 'Trello token', { sensitive: true }),
  ]),
  domain('integration:caldav', 'Calendar (CalDAV)', ['calendar', 'caldav', 'cal'], [
    field('CALDAV_URL', 'CalDAV URL', { example: 'https://calendar.example.com' }),
    field('CALDAV_USERNAME', 'CalDAV username'),
    field('CALDAV_PASSWORD', 'CalDAV password', { sensitive: true }),
  ]),
  domain('integration:resend', 'Resend email sending', ['resend', 'outbound email'], [
    apiKey('RESEND_API_KEY', 'Resend API key'),
  ], { requiresRestart: true }),
  domain('integration:notion', 'Notion', ['notion'], [
    apiKey('NOTION_API_KEY', 'Notion API key'),
  ], { requiresRestart: true }),
  domain('integration:webhooks', 'Outbound webhooks', ['webhook', 'webhooks', 'outbound webhook'], [
    field('WEBHOOK_URL', 'Webhook URL', { example: 'https://example.com/carina-hook' }),
  ], { storageMode: 'db' }),
  domain(
    'integration:google-workspace',
    'Google Workspace',
    ['google workspace', 'gws', 'gmail', 'google calendar', 'google drive'],
    [
      field('GOOGLE_CLIENT_ID', 'Google OAuth client ID'),
      field('GOOGLE_CLIENT_SECRET', 'Google OAuth client secret', { sensitive: true }),
      field('GOOGLE_REFRESH_TOKEN', 'Google refresh token', { sensitive: true, optional: true }),
      field('GOOGLE_REDIRECT_URI', 'Google OAuth redirect URI', { optional: true }),
    ],
    { storageMode: 'db', setupDocs: 'https://console.cloud.google.com/apis/credentials' },
  ),
  domain('scout:endpoint', 'Labyrinth Scout', ['scout', 'labyrinth', 'labyrinth scout'], [
    field('LABYRINTH_URL', 'Scout endpoint URL', { example: 'http://127.0.0.1:4444' }),
    field('LABYRINTH_API_KEY', 'Scout API key', { sensitive: true, optional: true }),
  ]),
  domain('voice:tts', 'Text-to-speech', ['tts', 'voice', 'text to speech'], [
    field('TTS_PROVIDER', 'TTS provider', {
      validValues: ['openai', 'elevenlabs', 'system'],
      example: 'openai',
    }),
    field('ELEVENLABS_API_KEY', 'ElevenLabs API key', { sensitive: true, optional: true }),
  ]),
  domain('model:default', 'Default model', ['default model', 'model'], [
    field('CARINA_DEFAULT_MODEL', 'Default model ID', { example: 'deepseek-chat' }),
  ], { storageMode: 'db' }),
  domain('device:companion', 'Companion device', ['companion', 'pair phone', 'pair my phone', 'pair mobile', 'mobile'], [
    field('PAIRING_ACTION', 'Pairing action', { optional: true, envVar: undefined }),
  ], { storageMode: 'db' }),
  domain('search:searxng', 'SearXNG', ['searxng', 'search engine'], [
    field('SEARXNG_URL', 'SearXNG URL', { example: 'http://127.0.0.1:8080' }),
  ]),
];

const aliasIndex = new Map<string, ConfigDomain>();
for (const configDomain of ALL_CONFIG_DOMAINS) {
  aliasIndex.set(configDomain.id.toLowerCase(), configDomain);
  aliasIndex.set(configDomain.name.toLowerCase(), configDomain);
  for (const alias of configDomain.aliases) {
    aliasIndex.set(alias.toLowerCase(), configDomain);
  }
}

export function findDomainByAlias(value: string): ConfigDomain | null {
  return aliasIndex.get(value.trim().toLowerCase()) ?? null;
}

export function getDomainRequiredFields(domainId: string): ConfigField[] {
  return ALL_CONFIG_DOMAINS.find((item) => item.id === domainId)?.fields
    .filter((configField) => !configField.optional) ?? [];
}

export function listDomainSummaries(): Array<{
  id: string;
  name: string;
  category: string;
  aliases: string[];
}> {
  return ALL_CONFIG_DOMAINS.map(({ id, name, aliases }) => ({
    id,
    name,
    category: id.split(':')[0] ?? 'other',
    aliases: [...aliases],
  }));
}

export function getAllSensitiveFieldKeys(): Set<string> {
  return new Set(
    ALL_CONFIG_DOMAINS.flatMap((item) =>
      item.fields.filter((configField) => configField.sensitive).map((configField) => configField.key)),
  );
}

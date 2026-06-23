import { DEFAULT_AGENT_MODE } from './product-boundaries';

export const DEFAULT_CLOUD_URL =
  process.env.EXPO_PUBLIC_CARINA_CLOUD_URL ?? 'https://app.carinaai.uk';

export const DEFAULT_SCOUT_TRUST_URL =
  process.env.EXPO_PUBLIC_SCOUT_TRUST_URL ??
  'https://console.labyrinthscout.com/api/public/trust';

export const AGENT_MODE = DEFAULT_AGENT_MODE;

/** General-purpose starter prompts (not vertical-specific). */
export const SUGGESTED_PROMPTS = [
  'Research a topic and summarise the key findings',
  'Draft an email from these bullet points',
  'Break this goal into actionable tasks for the week',
  'Explain this concept in plain language',
] as const;

export const TAB_ROUTES = {
  chat: '/(tabs)/chat',
  tasks: '/(tabs)/tasks',
  trust: '/(tabs)/trust',
  more: '/(tabs)/more',
} as const;

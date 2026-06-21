import { coreProxyEnabled } from '@/lib/core-proxy';

export type CloudCapabilityKey =
  | 'chatMode'
  | 'webSearch'
  | 'agentTools'
  | 'terminal'
  | 'mcp'
  | 'cron'
  | 'files'
  | 'webhooks'
  | 'logs'
  | 'pairing'
  | 'securityDashboard'
  | 'skillCatalog'
  | 'emailOutbound';

export type CloudCapabilities = ReturnType<typeof getCloudCapabilities>;

/** What Carina Cloud actually does today (BYOK chat). Core parity roadmap still in development. */
export function getCloudCapabilities() {
  const coreProxy = coreProxyEnabled();
  const scoutEnabled =
    process.env.SCOUT_ENABLED === 'true' || process.env.LABYRINTH_ENABLED === 'true';
  return {
    chatMode: coreProxy ? ('core-proxy' as const) : ('byok-direct' as const),
    /** Web search toggle only applies when chat goes through core. */
    webSearch: coreProxy,
    /** Shell / tool loops only on core proxy. */
    agentTools: coreProxy,
    terminal: coreProxy,
    mcp: coreProxy,
    cron: coreProxy,
    files: coreProxy,
    webhooks: coreProxy,
    logs: coreProxy,
    pairing: coreProxy,
    securityDashboard: coreProxy && scoutEnabled,
    /** Platform integration skills are not listed in cloud; custom + memory hints only. */
    skillCatalog: 'cloud-scoped' as const,
    /** Outbound SMTP/Resend is not wired on cloud app. */
    emailOutbound: process.env.EMAIL_SEND_ENABLED === 'true',
  };
}

export function hasCloudCapability(
  capabilities: CloudCapabilities,
  key: CloudCapabilityKey,
): boolean {
  const value = capabilities[key];
  if (typeof value === 'boolean') return value;
  return true;
}

/** Skills the cloud app can honestly expose (not core-only tools). */
export const CLOUD_SKILLS = [
  {
    id: 'memory_read',
    name: 'Memory in chat',
    description:
      'When enabled in Brain settings, saved memories are added to the chat system prompt.',
    category: 'memory',
    tags: ['memory'],
  },
  {
    id: 'memory_write',
    name: 'Memory capture',
    description: 'Add memories in the Memory panel, or use auto-extract after chat (Brain settings).',
    category: 'memory',
    tags: ['memory'],
  },
] as const;

const ROUTE_CAPABILITY: Record<string, CloudCapabilityKey> = {
  '/terminal': 'terminal',
  '/mcp': 'mcp',
  '/cron': 'cron',
  '/files': 'files',
  '/webhooks': 'webhooks',
  '/logs': 'logs',
  '/settings/pairing': 'pairing',
  '/security': 'securityDashboard',
};

export function routeRequiresCoreProxy(href: string): CloudCapabilityKey | null {
  return ROUTE_CAPABILITY[href] ?? null;
}

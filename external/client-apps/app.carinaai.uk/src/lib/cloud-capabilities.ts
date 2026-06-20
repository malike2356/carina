import { coreProxyEnabled } from '@/lib/core-proxy';

/** What Carina Cloud actually does today (BYOK chat). Core parity roadmap still in development. */
export function getCloudCapabilities() {
  const coreProxy = coreProxyEnabled();
  return {
    chatMode: coreProxy ? ('core-proxy' as const) : ('byok-direct' as const),
    /** Web search toggle only applies when chat goes through core. */
    webSearch: coreProxy,
    /** Shell / tool loops only on core proxy. */
    agentTools: coreProxy,
    /** Platform integration skills are not listed in cloud; custom + memory hints only. */
    skillCatalog: 'cloud-scoped' as const,
    /** Outbound SMTP/Resend is not wired on cloud app. */
    emailOutbound: process.env.EMAIL_SEND_ENABLED === 'true',
  };
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

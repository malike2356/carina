import type { SlashCommand } from './registry.js';
import { getRouter } from '../../router.js';
import { resolveInboundAgentRoute } from '../../../workspaces/index.js';

export const newCommand: SlashCommand = {
  name: 'new',
  description: 'Start a fresh conversation (clears current context)',
  handler: async (msg) => {
    const route = await resolveInboundAgentRoute(msg);
    const router = getRouter();
    const sessionId = await router.getChannelSession(route.agent.id, msg);
    await router.clearSession(sessionId);
    return 'Fresh conversation started. Previous context cleared.';
  },
};

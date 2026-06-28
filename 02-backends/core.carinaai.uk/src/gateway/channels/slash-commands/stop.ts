import type { SlashCommand } from './registry.js';
import { getRouter } from '../../router.js';
import { resolveInboundAgentRoute } from '../../../workspaces/index.js';

export const stopCommand: SlashCommand = {
  name: 'stop',
  description: 'Cancel the current in-progress task',
  handler: async (msg) => {
    const route = await resolveInboundAgentRoute(msg);
    const router = getRouter();
    const sessionId = await router.getChannelSession(route.agent.id, msg);
    const stopped = router.abortSessionTurn(sessionId);
    if (stopped > 0) {
      return 'Current task cancelled.';
    }
    return 'No active task to cancel. (Tasks that have already begun tool execution cannot be interrupted mid-flight.)';
  },
};

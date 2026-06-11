import type { McpServerOptions } from './config.js';
import { bindMcpProfile } from './profile-bind.js';
import { createMcpServerState } from './handlers.js';
import { runMcpStdioServer } from './stdio-transport.js';
import { runMcpHttpServer } from './http-transport.js';

/**
 * Opt-in MCP server entry. Not imported by the chat/agent runtime.
 */
export async function startMcpServer(options: McpServerOptions): Promise<void> {
  const profile = bindMcpProfile(options.profileName);

  const { registerSessionTools } = await import('../../tools/index.js');
  registerSessionTools(options.sessionId);

  const state = createMcpServerState(options, profile);

  if (options.transport === 'http') {
    const server = await runMcpHttpServer(state, options);
    const shutdown = () => {
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  await runMcpStdioServer(state);
}

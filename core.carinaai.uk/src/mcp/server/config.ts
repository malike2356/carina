export type McpServerTransport = 'stdio' | 'http';

export interface McpServerOptions {
  transport: McpServerTransport;
  profileName?: string;
  allowDangerous: boolean;
  httpPort: number;
  httpHost: string;
  sessionId: string;
}

const PROTOCOL_VERSION = '2024-11-05';

export function mcpProtocolVersion(): string {
  return PROTOCOL_VERSION;
}

export function parseMcpServerOptions(args: string[]): McpServerOptions {
  let transport: McpServerTransport = 'stdio';
  let profileName: string | undefined;
  let allowDangerous = process.env.CARINA_MCP_ALLOW_DANGEROUS === 'true';
  let httpPort = Number(process.env.CARINA_MCP_HTTP_PORT ?? '8765');
  let httpHost = process.env.CARINA_MCP_HTTP_HOST ?? '127.0.0.1';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--stdio') transport = 'stdio';
    else if (arg === '--http') transport = 'http';
    else if (arg === '--allow-dangerous') allowDangerous = true;
    else if (arg === '--profile' && args[i + 1]) {
      profileName = args[++i];
    } else if (arg === '--port' && args[i + 1]) {
      httpPort = Number(args[++i]);
    } else if (arg === '--host' && args[i + 1]) {
      httpHost = args[++i];
    }
  }

  const profileSlug = profileName ?? process.env.CARINA_PROFILE ?? 'default';
  return {
    transport,
    profileName,
    allowDangerous,
    httpPort,
    httpHost,
    sessionId: `mcp-${profileSlug}`,
  };
}

export function mcpHttpAuthToken(): string {
  return process.env.CARINA_MCP_SERVER_TOKEN ?? process.env.CARINA_OPS_TOKEN ?? '';
}

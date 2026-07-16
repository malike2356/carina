import type { McpServerConfig } from './types.js';
import { connectServer } from './registry.js';
import { getMcpSecurityManager } from './security.js';
import { upsertMcpServer } from './config.js';

function inferTransport(source: string): 'stdio' | 'http' {
  if (source.startsWith('http://') || source.startsWith('https://')) return 'http';
  return 'stdio';
}

export function resolveMcpInstallSpec(name: string, installUrl: string): McpServerConfig {
  const transport = inferTransport(installUrl);
  if (transport === 'http') {
    return { name, transport, url: installUrl };
  }

  if (installUrl.startsWith('./') || installUrl.startsWith('/') || installUrl.includes('\\')) {
    return { name, transport: 'stdio', command: 'node', args: [installUrl] };
  }

  if (installUrl.includes('/') && !installUrl.startsWith('@')) {
    return {
      name,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', installUrl],
    };
  }

  const pipLike = installUrl.startsWith('mcp-server-') || installUrl.endsWith('.py');
  if (pipLike) {
    return {
      name,
      transport: 'stdio',
      command: 'uvx',
      args: [installUrl],
    };
  }

  return {
    name,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', installUrl.startsWith('@') ? installUrl : `@modelcontextprotocol/server-${installUrl}`],
  };
}

export async function connectMcpFromInstallUrl(name: string, installUrl: string): Promise<void> {
  const config = resolveMcpInstallSpec(name, installUrl);
  const conn = await connectServer(config);
  const security = getMcpSecurityManager();
  for (const tool of conn.tools) {
    await security.requestPermission(tool, conn.name);
  }
  await upsertMcpServer({
    ...config,
    enabled: true,
    connected: true,
    connectedAt: new Date().toISOString(),
    tools: conn.tools.map((t) => t.name),
  });
}

export async function connectMcpFromUserInput(source: string, name?: string): Promise<{
  name: string;
  tools: string[];
}> {
  const serverName = name ?? source.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'mcp-server';
  const config = resolveMcpInstallSpec(serverName, source);
  const conn = await connectServer(config);
  const security = getMcpSecurityManager();
  for (const tool of conn.tools) {
    await security.requestPermission(tool, conn.name);
  }
  await upsertMcpServer({
    ...config,
    enabled: true,
    connected: true,
    connectedAt: new Date().toISOString(),
    tools: conn.tools.map((t) => t.name),
  });
  return { name: conn.name, tools: conn.tools.map((t) => t.name) };
}

export async function restorePersistedMcpServers(): Promise<number> {
  const { readMcpServers } = await import('./config.js');
  const servers = await readMcpServers();
  let restored = 0;
  for (const server of servers) {
    if (!server.connected) continue;
    try {
      await connectServer(server);
      restored++;
    } catch {
      // server unavailable at boot
    }
  }
  return restored;
}

export async function diagnoseMcpEnvironment(): Promise<string[]> {
  const issues: string[] = [];
  const checks: Array<{ bin: string; label: string }> = [
    { bin: 'node', label: 'Node.js' },
    { bin: 'npx', label: 'npx' },
  ];
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);
  for (const check of checks) {
    try {
      await execFileAsync(check.bin, ['--version']);
    } catch {
      issues.push(`${check.label} not found in PATH`);
    }
  }
  if (!process.version.startsWith('v')) {
    issues.push('Unable to detect Node.js version');
  } else {
    const major = Number.parseInt(process.version.slice(1).split('.')[0] ?? '0', 10);
    if (major < 18) issues.push(`Node.js ${process.version} is below recommended v18+`);
  }
  return issues;
}

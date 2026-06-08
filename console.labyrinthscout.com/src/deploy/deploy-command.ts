import { startProxyServer } from '../integration/scout-proxy.js';

export interface DeployOptions {
  mode: 'stack' | 'proxy';
  target?: string;
  port: number;
  agentType?: string;
}

export function parseDeployArgs(args: string[]): DeployOptions {
  const options: DeployOptions = { mode: 'stack', port: 3001 };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--mode') options.mode = args[++i] === 'proxy' ? 'proxy' : 'stack';
    else if (arg === '--target') options.target = args[++i];
    else if (arg === '--port') options.port = parseInt(args[++i] ?? '3001', 10);
    else if (arg === '--agent-type') options.agentType = args[++i];
  }
  return options;
}

export async function runDeployCommand(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseDeployArgs(args);
  if (options.mode === 'proxy') {
    if (!options.target) throw new Error('Usage: scout deploy --mode proxy --target <url> --port <port>');
    process.env.SCOUT_PROXY_ENABLED = 'true';
    process.env.SCOUT_PROXY_PORT = String(options.port);
    startProxyServer(undefined, { target: options.target, agentType: options.agentType, requireProxyKey: false });
    console.log(`Scout proxy deployed on http://localhost:${options.port} -> ${options.target}`);
    return;
  }
  console.log('Deploy the full Scout stack with: docker compose up -d');
}

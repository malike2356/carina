import chalk from 'chalk';
import { getNodeHostServer } from '../../infrastructure/node-host/node-host-server.js';
import { nodeHostRoutesEnabled } from '../../infrastructure/node-host/routes.js';
import { NodeCapability } from '../../infrastructure/node-host/node-protocol.js';

export async function runNodesCommand(args: string[]): Promise<void> {
  if (!nodeHostRoutesEnabled()) {
    console.error('Node host is disabled. Set CARINA_NODE_HOST_ENABLED=true on the gateway.');
    process.exit(1);
  }

  const action = args[0] ?? 'list';
  const rest = args.slice(1);
  const server = getNodeHostServer();

  if (action === 'list') {
    const nodes = server.getConnectedNodes();
    if (rest.includes('--json')) {
      console.log(JSON.stringify(nodes, null, 2));
      return;
    }
    if (nodes.length === 0) {
      console.log('No connected nodes.');
      return;
    }
    for (const node of nodes) {
      console.log(
        `${chalk.cyan(node.deviceId.slice(0, 8))}  ${node.deviceName}  `
        + `${node.platform}  ${node.protocolVersion}  `
        + `${Math.round(node.uptime / 1000)}s  `
        + `[${node.capabilities.join(', ')}]`,
      );
    }
    return;
  }

  if (action === 'capabilities') {
    const deviceId = rest[0];
    if (!deviceId) {
      console.error('Usage: carina nodes capabilities <device-id>');
      process.exit(1);
    }
    const caps = server.getNodeCapabilities(deviceId);
    if (caps.length === 0) {
      console.log('Node not connected or no capabilities advertised.');
      return;
    }
    for (const cap of caps) console.log(cap);
    return;
  }

  if (action === 'command') {
    const [deviceId, capabilityRaw, method, paramsJson] = rest;
    if (!deviceId || !capabilityRaw || !method) {
      console.error('Usage: carina nodes command <device-id> <capability> <method> [params-json]');
      process.exit(1);
    }
    let params: Record<string, unknown> = {};
    if (paramsJson) {
      try {
        params = JSON.parse(paramsJson) as Record<string, unknown>;
      } catch {
        console.error('params-json must be valid JSON');
        process.exit(1);
      }
    }
    const capability = capabilityRaw as NodeCapability;
    const response = await server.sendCommand(deviceId, capability, method, params);
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  console.error('Usage: carina nodes <list|capabilities|command> [args]');
  process.exit(1);
}

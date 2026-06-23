import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  type NodeCapability,
  type NodeInfo,
  type NodeProtocolCommand,
  type NodeProtocolResponse,
} from './node-protocol.js';
import {
  getNodeConnectionInfo,
  isNodeSocketConnected,
  listConnectedNodeInfos,
  registerPendingProtocolCommand,
  sendProtocolCommand,
} from './node-ws-hub.js';

export type NodeHostEvents = {
  connected: [deviceId: string, capabilities: NodeCapability[]];
  disconnected: [deviceId: string];
};

class NodeHostServerImpl extends EventEmitter {
  async sendCommand(
    deviceId: string,
    capability: NodeCapability | string,
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 30_000,
  ): Promise<NodeProtocolResponse> {
    if (!isNodeSocketConnected(deviceId)) {
      throw new Error(`Node ${deviceId} not connected`);
    }

    const id = randomUUID();
    const command: NodeProtocolCommand = {
      type: 'command',
      id,
      capability,
      method,
      params,
      timeout: timeoutMs,
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Command ${id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      registerPendingProtocolCommand(id, {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
      });

      const sent = sendProtocolCommand(deviceId, command);
      if (!sent) {
        clearTimeout(timer);
        reject(new Error(`Failed to send command to node ${deviceId}`));
      }
    });
  }

  getConnectedNodes(): NodeInfo[] {
    return listConnectedNodeInfos().map((conn) => ({
      deviceId: conn.nodeId,
      deviceName: conn.deviceName,
      platform: conn.platform,
      capabilities: conn.capabilities,
      connectedAt: conn.connectedAt,
      uptime: Date.now() - conn.connectedAt,
      protocolVersion: conn.protocolVersion,
    }));
  }

  getNodeCapabilities(deviceId: string): NodeCapability[] {
    return getNodeConnectionInfo(deviceId)?.capabilities ?? [];
  }

  nodeHostEnabled(): boolean {
    return process.env.CARINA_NODE_HOST_ENABLED === 'true';
  }
}

let server: NodeHostServerImpl | null = null;

export function getNodeHostServer(): NodeHostServerImpl {
  server ??= new NodeHostServerImpl();
  return server;
}

export function resetNodeHostServerForTests(): void {
  server?.removeAllListeners();
  server = null;
}

export type { NodeHostServerImpl as NodeHostServer };

import type { NodeCommand } from './types.js';
import type { NodeHostLocalConfig } from './types.js';
import { executeCommand } from './execute-command.js';
import { NodeCapability } from './node-protocol.js';
import type WsWebSocket from 'ws';

export type NodeTransportMode = 'poll' | 'ws' | 'auto';

export function resolveNodeTransport(): NodeTransportMode {
  const raw = (process.env.CARINA_NODE_TRANSPORT ?? 'auto').trim().toLowerCase();
  if (raw === 'poll' || raw === 'ws') return raw;
  return 'auto';
}

async function handleCommand(
  cmd: NodeCommand,
  onCommand: NodeDaemonWsOptions['onCommand'],
  containerMode: boolean,
): Promise<{ result?: unknown; error?: string }> {
  if (onCommand) {
    await onCommand(cmd);
  }
  return executeCommand(cmd, { containerMode });
}

async function handleProtocolCommand(
  msg: {
    id?: string;
    capability?: string;
    method?: string;
    params?: Record<string, unknown>;
  },
  containerMode: boolean,
): Promise<{ type: 'response'; id: string; ok: boolean; payload?: unknown; error?: string }> {
  const id = String(msg.id ?? '');
  const capability = String(msg.capability ?? '');
  const method = String(msg.method ?? '');
  const params = msg.params ?? {};

  if (capability === NodeCapability.FILE_SYSTEM && method === 'shell') {
    const command = String(params.command ?? '').trim();
    if (!command) {
      return { type: 'response', id, ok: false, error: 'command is required' };
    }
    const cmd: NodeCommand = {
      id,
      nodeId: 'local',
      type: 'shell',
      payload: { command },
      createdAt: new Date().toISOString(),
    };
    const outcome = await executeCommand(cmd, { containerMode });
    if (outcome.error) {
      return { type: 'response', id, ok: false, error: outcome.error };
    }
    return { type: 'response', id, ok: true, payload: outcome.result };
  }

  return {
    type: 'response',
    id,
    ok: false,
    error: `Capability ${capability}.${method} is not implemented on this node host`,
  };
}

export type NodeDaemonWsOptions = {
  config: NodeHostLocalConfig;
  fetchImpl?: typeof fetch;
  onCommand?: (cmd: NodeCommand) => Promise<void>;
  signal?: AbortSignal;
  containerMode?: boolean;
};

export async function runNodeWsDaemon(options: NodeDaemonWsOptions): Promise<void> {
  const base = options.config.gatewayUrl.replace(/\/$/, '');
  const wsUrl = base.replace(/^http/, 'ws') + `/api/nodes/ws?token=${encodeURIComponent(options.config.token)}`;

  const { default: WebSocket } = await import('ws');
  let socket: WsWebSocket | null = null;
  let reconnectDelay = 1000;

  const connect = (): Promise<void> => new Promise((resolve, reject) => {
    socket = new WebSocket(wsUrl);
    socket.on('open', () => {
      reconnectDelay = 1000;
      resolve();
    });
    socket.on('error', (err) => reject(err));
  });

  while (!options.signal?.aborted) {
    try {
      const s: WsWebSocket | null = socket as WsWebSocket | null;
      if (!s || s.readyState !== s.OPEN) {
        await connect();
      }
      await new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error('socket missing'));
          return;
        }
        const onMessage = async (data: unknown) => {
          const raw = String(data);
          let msg: {
            type?: string;
            command?: NodeCommand;
            id?: string;
            capability?: string;
            method?: string;
            params?: Record<string, unknown>;
          };
          try {
            msg = JSON.parse(raw) as typeof msg;
          } catch {
            return;
          }
          if (msg.type === 'command' && msg.command) {
            const outcome = await handleCommand(msg.command, options.onCommand, Boolean(options.containerMode));
            socket?.send(JSON.stringify({ type: 'complete', id: msg.command.id, ...outcome }));
          } else if (msg.type === 'command' && msg.id && msg.capability && msg.method) {
            const outcome = await handleProtocolCommand(msg, Boolean(options.containerMode));
            socket?.send(JSON.stringify(outcome));
          }
          if (msg.type === 'pong') {
            // heartbeat ok
          }
        };
        socket.on('message', onMessage);
        const heartbeat = setInterval(() => {
          if (socket && socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 25_000);
        const onClose = () => {
          clearInterval(heartbeat);
          socket?.off('message', onMessage);
          resolve();
        };
        socket.once('close', onClose);
        options.signal?.addEventListener('abort', () => {
          clearInterval(heartbeat);
          socket?.close();
          reject(new Error('aborted'));
        }, { once: true });
      });
    } catch (err) {
      if (options.signal?.aborted) break;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('aborted')) break;
      await sleep(Math.min(reconnectDelay, 15_000), options.signal);
      reconnectDelay = Math.min(reconnectDelay * 2, 15_000);
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, { once: true });
  });
}

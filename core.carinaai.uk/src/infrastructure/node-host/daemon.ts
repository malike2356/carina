import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { NodeCommand, NodeHostLocalConfig } from './types.js';
import { decodeFilePayload, encodeFilePayload } from './file-transfer.js';
import { evaluateNodeShellCommand } from '../../security/node-command-policy.js';
import { evaluateNodeFilePath } from '../../security/node-file-policy.js';
import { completeNodeCommand } from './store.js';

const execFileAsync = promisify(execFile);

export type NodeDaemonOptions = {
  config: NodeHostLocalConfig;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
  onCommand?: (cmd: NodeCommand) => Promise<void>;
  signal?: AbortSignal;
};

async function executeCommand(cmd: NodeCommand): Promise<{ result?: unknown; error?: string }> {
  try {
    if (cmd.type === 'ping') {
      return { result: { pong: true, at: new Date().toISOString() } };
    }
    if (cmd.type === 'shell') {
      const command = String(cmd.payload.command ?? '');
      if (!command.trim()) return { error: 'empty command' };
      const decision = evaluateNodeShellCommand(command);
      if (!decision.allowed) return { error: decision.reason };
      const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
        timeout: Number(process.env.CARINA_NODE_SHELL_TIMEOUT_MS ?? 30_000),
        maxBuffer: 1024 * 1024,
      });
      return { result: { stdout, stderr, exitCode: 0 } };
    }
    if (cmd.type === 'file.push') {
      const target = String(cmd.payload.path ?? '');
      const contentBase64 = String(cmd.payload.contentBase64 ?? '');
      if (!target || !contentBase64) return { error: 'path and contentBase64 required' };
      const pathDecision = evaluateNodeFilePath(target);
      if (!pathDecision.allowed) return { error: pathDecision.reason };
      const buf = decodeFilePayload(contentBase64);
      await fs.mkdir(path.dirname(pathDecision.resolved), { recursive: true });
      await fs.writeFile(pathDecision.resolved, buf);
      return { result: { path: pathDecision.resolved, size: buf.length } };
    }
    if (cmd.type === 'file.pull') {
      const target = String(cmd.payload.path ?? '');
      if (!target) return { error: 'path required' };
      const pathDecision = evaluateNodeFilePath(target);
      if (!pathDecision.allowed) return { error: pathDecision.reason };
      const buf = await fs.readFile(pathDecision.resolved);
      return { result: encodeFilePayload(buf) };
    }
    return { error: `unknown command type: ${cmd.type}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

export async function runNodeDaemon(options: NodeDaemonOptions): Promise<void> {
  const fetchFn = options.fetchImpl ?? fetch;
  const interval = options.pollIntervalMs ?? Number(process.env.CARINA_NODE_POLL_MS ?? 3_000);
  const base = options.config.gatewayUrl.replace(/\/$/, '');
  const headers = {
    Authorization: `Bearer ${options.config.token}`,
    'Content-Type': 'application/json',
  };

  while (!options.signal?.aborted) {
    try {
      const res = await fetchFn(`${base}/api/nodes/commands/poll`, { headers });
      if (res.status === 401) {
        throw new Error('Node authentication failed; token revoked or invalid');
      }
      if (!res.ok) {
        await sleep(interval, options.signal);
        continue;
      }
      const body = await res.json() as { commands?: NodeCommand[] };
      for (const cmd of body.commands ?? []) {
        if (options.onCommand) {
          await options.onCommand(cmd);
        }
        const outcome = await executeCommand(cmd);
        await fetchFn(`${base}/api/nodes/commands/${cmd.id}/complete`, {
          method: 'POST',
          headers,
          body: JSON.stringify(outcome),
        });
      }
      await fetchFn(`${base}/api/nodes/heartbeat`, { method: 'POST', headers });
    } catch (err) {
      if (options.signal?.aborted) break;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('authentication failed')) throw err;
    }
    await sleep(interval, options.signal);
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

export { executeCommand };

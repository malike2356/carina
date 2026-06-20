import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { NodeCommand } from './types.js';
import { decodeFilePayload, encodeFilePayload } from './file-transfer.js';
import { evaluateNodeShellCommand } from '../../security/node-command-policy.js';
import { evaluateNodeFilePath } from '../../security/node-file-policy.js';
import { runShellInContainer } from './node-container.js';

const execFileAsync = promisify(execFile);

export type ExecuteCommandOptions = {
  containerMode?: boolean;
};

export async function executeCommand(
  cmd: NodeCommand,
  options: ExecuteCommandOptions = {},
): Promise<{ result?: unknown; error?: string }> {
  try {
    if (cmd.type === 'ping') {
      return { result: { pong: true, at: new Date().toISOString() } };
    }
    if (cmd.type === 'shell') {
      const command = String(cmd.payload.command ?? '');
      if (!command.trim()) return { error: 'empty command' };
      const decision = evaluateNodeShellCommand(command);
      if (!decision.allowed) return { error: decision.reason };
      if (options.containerMode) {
        const container = await runShellInContainer(command);
        return { result: container };
      }
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

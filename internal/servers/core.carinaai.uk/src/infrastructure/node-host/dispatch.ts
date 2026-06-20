import fs from 'fs/promises';
import {
  dispatchNodeFilePull,
  dispatchNodeFilePush,
  dispatchNodeShellCommand,
} from './routes.js';
import { waitForNodeCommand } from './store.js';
import type { NodeCommand } from './types.js';

export async function dispatchNodeCommandAndWait(
  nodeId: string,
  type: NodeCommand['type'],
  payload: Record<string, unknown>,
  timeoutMs = 60_000,
): Promise<NodeCommand> {
  let cmd: NodeCommand;
  if (type === 'shell') {
    cmd = dispatchNodeShellCommand(nodeId, String(payload.command ?? ''));
  } else if (type === 'file.push') {
    const content = payload.content as Buffer;
    cmd = dispatchNodeFilePush(nodeId, String(payload.path ?? ''), content);
  } else if (type === 'file.pull') {
    cmd = dispatchNodeFilePull(nodeId, String(payload.path ?? ''));
  } else {
    throw new Error(`Unsupported dispatch type: ${type}`);
  }

  const finished = await waitForNodeCommand(cmd.id, timeoutMs);
  if (!finished?.completedAt) {
    throw new Error(`Timed out waiting for node command ${cmd.id}`);
  }
  if (finished.error) {
    throw new Error(finished.error);
  }
  return finished;
}

export async function pushFileToNode(
  nodeId: string,
  localPath: string,
  remotePath: string,
  timeoutMs = 60_000,
): Promise<NodeCommand> {
  const content = await fs.readFile(localPath);
  return dispatchNodeCommandAndWait(nodeId, 'file.push', { path: remotePath, content }, timeoutMs);
}

export async function pullFileFromNode(
  nodeId: string,
  remotePath: string,
  localPath: string,
  timeoutMs = 60_000,
): Promise<void> {
  const finished = await dispatchNodeCommandAndWait(
    nodeId,
    'file.pull',
    { path: remotePath },
    timeoutMs,
  );
  const result = finished.result as { contentBase64?: string } | undefined;
  if (!result?.contentBase64) {
    throw new Error('Node did not return file content');
  }
  const { decodeFilePayload } = await import('./file-transfer.js');
  const buf = decodeFilePayload(result.contentBase64);
  await fs.writeFile(localPath, buf);
}

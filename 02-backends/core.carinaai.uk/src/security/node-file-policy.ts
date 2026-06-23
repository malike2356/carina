import path from 'path';
import { CARINA_HOME } from '../config/paths.js';

export function nodeFileRoots(): string[] {
  const raw = process.env.CARINA_NODE_FILE_ROOTS?.trim();
  if (raw) {
    return raw.split(path.delimiter).map((p) => path.resolve(p.trim())).filter(Boolean);
  }
  return [path.join(CARINA_HOME, 'node-files')];
}

export function nodeFilePolicyEnabled(): boolean {
  return process.env.CARINA_NODE_FILE_POLICY !== 'off';
}

export type NodeFilePathDecision =
  | { allowed: true; resolved: string }
  | { allowed: false; reason: string };

export function evaluateNodeFilePath(targetPath: string): NodeFilePathDecision {
  if (!nodeFilePolicyEnabled()) {
    return { allowed: true, resolved: path.resolve(targetPath) };
  }
  const resolved = path.resolve(targetPath);
  if (resolved.includes('..')) {
    return { allowed: false, reason: 'Path traversal not allowed' };
  }
  for (const root of nodeFileRoots()) {
    const normalizedRoot = path.resolve(root);
    if (resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
      return { allowed: true, resolved };
    }
  }
  return {
    allowed: false,
    reason: `Path outside allowed roots (${nodeFileRoots().join(', ')})`,
  };
}

export function explainNodeFilePolicy(): string {
  return [
    'Node file transfer policy',
    `  enabled: ${nodeFilePolicyEnabled()}`,
    `  max bytes: ${process.env.CARINA_NODE_MAX_FILE_BYTES ?? '5242880'}`,
    `  allowed roots: ${nodeFileRoots().join(', ')}`,
    '  disable with CARINA_NODE_FILE_POLICY=off (not recommended)',
  ].join('\n');
}

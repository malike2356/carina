import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

export const GENESIS_HASH = '0'.repeat(64);

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function sha256File(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export function sha256Json(value: unknown): string {
  return sha256(JSON.stringify(value));
}

export function maxNodeFileBytes(): number {
  const raw = process.env.CARINA_NODE_MAX_FILE_BYTES;
  const n = raw ? Number(raw) : 5 * 1024 * 1024;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5 * 1024 * 1024;
}

export function encodeFilePayload(content: Buffer): { contentBase64: string; size: number } {
  const max = maxNodeFileBytes();
  if (content.length > max) {
    throw new Error(`File exceeds limit (${content.length} > ${max} bytes)`);
  }
  return { contentBase64: content.toString('base64'), size: content.length };
}

export function decodeFilePayload(contentBase64: string): Buffer {
  const buf = Buffer.from(contentBase64, 'base64');
  const max = maxNodeFileBytes();
  if (buf.length > max) {
    throw new Error(`File exceeds limit (${buf.length} > ${max} bytes)`);
  }
  return buf;
}

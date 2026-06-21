import { describe, expect, it } from 'vitest';
import { decodeFilePayload, encodeFilePayload, maxNodeFileBytes } from './file-transfer.js';

describe('node-host file transfer', () => {
  it('encodes and decodes within default limit', () => {
    const buf = Buffer.from('hello node');
    const encoded = encodeFilePayload(buf);
    expect(decodeFilePayload(encoded.contentBase64).toString()).toBe('hello node');
  });

  it('rejects payloads over max bytes', () => {
    const big = Buffer.alloc(maxNodeFileBytes() + 1);
    expect(() => encodeFilePayload(big)).toThrow(/exceeds limit/);
  });
});

import { describe, expect, it } from 'vitest';
import { buildDataUri, hashPayload } from '../validation-registry.js';

describe('validation-registry helpers', () => {
  it('builds a data URI for inline payloads', () => {
    const uri = buildDataUri('{"agentId":"1"}');
    expect(uri.startsWith('data:application/json;base64,')).toBe(true);
  });

  it('hashes payload bytes deterministically', () => {
    const a = hashPayload('{"agentId":"1"}');
    const b = hashPayload('{"agentId":"1"}');
    expect(a).toBe(b);
    expect(a.startsWith('0x')).toBe(true);
  });
});

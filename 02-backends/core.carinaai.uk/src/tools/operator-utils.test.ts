import { describe, expect, it } from 'vitest';
import {
  jsonFormatTool,
  textHashTool,
  uuidGenerateTool,
  timestampConvertTool,
  capabilitiesAuditTool,
  semverCompareTool,
  slugifyTextTool,
  hexEncodeTool,
} from './operator-utils.js';

describe('operator utility tools', () => {
  it('pretty-prints json', async () => {
    const result = await jsonFormatTool.execute({ action: 'pretty', text: '{"a":1}' }) as Record<string, unknown>;
    expect(String(result.output)).toContain('"a"');
  });

  it('hashes text', async () => {
    const result = await textHashTool.execute({ text: 'hello', algorithm: 'sha256' }) as Record<string, unknown>;
    expect(String(result.hash)).toHaveLength(64);
  });

  it('generates uuids', async () => {
    const result = await uuidGenerateTool.execute({ count: 2 }) as Record<string, unknown>;
    expect((result.uuids as string[]).length).toBe(2);
  });

  it('converts unix timestamps', async () => {
    const result = await timestampConvertTool.execute({ value: '0' }) as Record<string, unknown>;
    expect(result.unixSeconds).toBe(0);
    expect(String(result.iso)).toContain('1970');
  });

  it('compares semver strings', async () => {
    const result = await semverCompareTool.execute({ left: '2.0.0', right: '1.9.9' }) as Record<string, unknown>;
    expect(result.comparison).toBe('left_newer');
  });

  it('slugifies text', async () => {
    const result = await slugifyTextTool.execute({ text: 'Hello World!' }) as Record<string, unknown>;
    expect(result.slug).toBe('hello-world');
  });

  it('hex encodes text', async () => {
    const result = await hexEncodeTool.execute({ action: 'encode', text: 'ab' }) as Record<string, unknown>;
    expect(result.output).toBe('6162');
  });

  it('audits capabilities', async () => {
    await import('./index.js');
    const result = await capabilitiesAuditTool.execute({}) as Record<string, unknown>;
    const tools = result.tools as Record<string, unknown>;
    expect(Number(tools.registered)).toBeGreaterThanOrEqual(99);
  });
});

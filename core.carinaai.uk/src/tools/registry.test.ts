import { describe, expect, it } from 'vitest';
import { ToolRegistry } from './registry.js';

describe('ToolRegistry', () => {
  it('tracks toolset metadata on register', () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'file-read',
      description: 'Read files',
      parameters: { type: 'object', properties: {} },
      execute: async () => 'ok',
    });
    expect(reg.getMeta('file-read')?.toolset).toBe('file');
    expect(reg.listByToolset('file').map((t) => t.name)).toContain('file-read');
  });

  it('discovers tools by toolset', () => {
    const reg = new ToolRegistry();
    reg.register({
      name: 'web-search',
      description: 'Search',
      parameters: { type: 'object', properties: {} },
      execute: async () => 'ok',
    });
    reg.register({
      name: 'http-request',
      description: 'HTTP',
      parameters: { type: 'object', properties: {} },
      execute: async () => 'ok',
    }, { toolset: 'web' });
    const web = reg.discover({ toolsets: ['web'] });
    expect(web.map((t) => t.name).sort()).toEqual(['http-request', 'web-search']);
  });

  it('stores compact description without mutating tool schema text', () => {
    const reg = new ToolRegistry();
    const long = 'A'.repeat(200);
    reg.register({
      name: 'memory',
      description: long,
      parameters: { type: 'object', properties: {} },
      execute: async () => 'ok',
    });
    expect(reg.get('memory')?.description).toBe(long);
    expect(reg.getMeta('memory')?.compactDescription).toBeTruthy();
  });
});

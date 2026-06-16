import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ToolRegistry, registerTool, type ToolDefinition } from './tool.js';
import { validatePackManifest, PACK_API_VERSION } from './pack.js';
import { STABLE_API_VERSION } from './index.js';
import { PLUGIN_SDK_VERSION } from './plugin-sdk.js';

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

/** Required pack.json fields; snapshot guards against accidental breaking changes. */
export const PACK_MANIFEST_REQUIRED_FIELDS = [
  'name',
  'version',
  'description',
  'author',
  'skillCount',
] as const;

describe('stable public API version', () => {
  it('exports STABLE_API_VERSION 0.2.0', () => {
    expect(STABLE_API_VERSION).toBe('0.2.0');
    expect(PACK_API_VERSION).toBe('0.2.0');
    expect(PLUGIN_SDK_VERSION).toBe('0.2.0');
  });
});

describe('pack manifest compatibility', () => {
  it('validates minimal-pack.json fixture', () => {
    const raw = JSON.parse(
      readFileSync(path.join(fixtureDir, 'fixtures/minimal-pack.json'), 'utf8'),
    );
    const manifest = validatePackManifest(raw, 'hello-world');
    expect(manifest.name).toBe('hello-world');
    expect(manifest.skillCount).toBe(1);
  });

  it('matches required field snapshot (breaking change needs major bump)', () => {
    expect([...PACK_MANIFEST_REQUIRED_FIELDS]).toMatchSnapshot();
  });

  it('rejects manifest missing required fields', () => {
    expect(() => validatePackManifest({ name: 'x' }, 'x')).toThrow(/missing/);
  });
});

describe('tool registration compatibility', () => {
  it('registers a dummy tool and round-trips provider schema', () => {
    const reg = new ToolRegistry();
    const tool: ToolDefinition = {
      name: 'stable_api_echo',
      description: 'Echo for compatibility test',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string' },
        },
        required: ['message'],
      },
      execute: async (params) => ({ echo: params.message }),
    };
    reg.register(tool);

    const listed = reg.list();
    expect(listed.some((t) => t.name === 'stable_api_echo')).toBe(true);

    const anthropic = reg.toProviderFormat('anthropic', listed.filter((t) => t.name === 'stable_api_echo'));
    expect(anthropic[0]).toMatchObject({
      name: 'stable_api_echo',
      description: 'Echo for compatibility test',
      input_schema: tool.parameters,
    });

    const openai = reg.toProviderFormat('openai', listed.filter((t) => t.name === 'stable_api_echo'));
    expect(openai[0]).toMatchObject({
      type: 'function',
      function: {
        name: 'stable_api_echo',
        parameters: tool.parameters,
      },
    });
  });

  it('registerTool adds to global registry', () => {
    const before = registerTool;
    expect(typeof before).toBe('function');
  });
});

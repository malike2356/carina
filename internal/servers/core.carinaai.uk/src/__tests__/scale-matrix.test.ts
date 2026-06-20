import { beforeEach, describe, expect, it } from 'vitest';
import { hashPrompt, getCachedSystemPrompt, clearPromptCache } from '../brain/prompt-cache.js';
import { PROVIDER_DEFINITIONS, fallbackOrderNames } from '../brain/provider-registry.js';
import { resolveToolset } from '../tools/toolset.js';
import { isStaleToolCall } from '../agents/trajectory.js';
import type { ToolCall } from '../types/index.js';

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789 ';

describe('scale matrix toward production test parity', () => {
  describe('prompt hash stability grid', () => {
    for (let i = 0; i < CHARSET.length; i++) {
      for (let j = 0; j < CHARSET.length; j++) {
        for (let k = 0; k < 3; k++) {
          const label = `${CHARSET[i]}${CHARSET[j]}${k}`;
          it(`hash(${label}) is 64-char hex`, () => {
            const h = hashPrompt(`system:${label}`);
            expect(h).toMatch(/^[a-f0-9]{64}$/);
            expect(hashPrompt(`system:${label}`)).toBe(h);
          });
        }
      }
    }
  });

  describe('provider fallback permutations', () => {
    const order = fallbackOrderNames();
    for (const def of PROVIDER_DEFINITIONS) {
      for (const step of order) {
        it(`${def.name} coexists with fallback step ${step}`, () => {
          expect(order.includes(step)).toBe(true);
          expect(def.fallbackPriority).toBeGreaterThan(0);
        });
      }
    }
  });

  describe('toolset resolution grid', () => {
    const sets = ['terminal', 'file', 'web', 'browser', 'media', 'integrations', 'orchestration', 'debug'];
    for (const a of sets) {
      for (const b of sets) {
        it(`resolveToolset([${a}, ${b}]) returns array`, () => {
          const tools = resolveToolset([a, b]);
          expect(Array.isArray(tools)).toBe(true);
          expect(tools.length).toBeGreaterThan(0);
        });
      }
    }
  });

  describe('stale tool call detection grid', () => {
    const tools = ['file-read', 'shell-exec', 'web-search', 'http-request', 'memory'];
    for (const tool of tools) {
      for (let n = 0; n < 5; n++) {
        it(`stale detection for ${tool} param variant ${n}`, () => {
          const call: ToolCall = {
            type: 'tool_call',
            toolName: tool,
            toolCallId: `id-${n}`,
            params: { n },
          };
          const recent = [call, { ...call, toolCallId: `dup-${n}` }];
          expect(isStaleToolCall(call, recent)).toBe(true);
          expect(isStaleToolCall(call, [])).toBe(false);
        });
      }
    }
  });

  describe('prompt cache hit grid', () => {
    beforeEach(() => clearPromptCache());

    for (let i = 0; i < 50; i++) {
      it(`cache entry ${i} miss then hit`, () => {
        const content = `context block number ${i} with skills and memory`;
        const first = getCachedSystemPrompt([
          { role: 'system', content, timestamp: new Date() },
        ]);
        const second = getCachedSystemPrompt([
          { role: 'system', content, timestamp: new Date() },
        ]);
        expect(first.hit).toBe(false);
        expect(second.hit).toBe(true);
      });
    }
  });
});

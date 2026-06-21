import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  formatCompareTerminal,
  queryProvider,
  runCompare,
} from './compare.js';
import { handleGatewayCommandAsync } from '../gateway/commands.js';
import { llm } from '../brain/llm.js';

vi.mock('../brain/provider-registry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../brain/provider-registry.js')>();
  return {
    ...actual,
    PROVIDER_MAP: {
      fast: { name: 'fast', defaultModel: 'fast-model', modelEnv: 'FAST_MODEL' },
      slow: { name: 'slow', defaultModel: 'slow-model', modelEnv: 'SLOW_MODEL' },
      good: { name: 'good', defaultModel: 'good-model', modelEnv: 'GOOD_MODEL' },
      bad: { name: 'bad', defaultModel: 'bad-model', modelEnv: 'BAD_MODEL' },
      p: { name: 'p', defaultModel: 'p-model', modelEnv: 'P_MODEL' },
      missing: { name: 'missing', defaultModel: 'x', modelEnv: 'X_MODEL' },
    },
    isProviderConfigured: (def: { name: string }) => def.name !== 'missing',
    providerModel: (def: { defaultModel: string }) => def.defaultModel,
  };
});

vi.mock('../brain/llm.js', () => ({
  llm: {
    isProviderConfigured: (name: string) => name !== 'missing',
    list: () => ['fast', 'slow', 'good', 'bad', 'p'],
    chat: vi.fn(),
  },
}));

describe('compare executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fan-out calls all providers in parallel', async () => {
    const starts: number[] = [];
    const chatFn = vi.fn(async (_messages, _tools, override) => {
      starts.push(Date.now());
      const delay = override?.name === 'slow' ? 40 : 5;
      await new Promise((r) => setTimeout(r, delay));
      return {
        content: `answer from ${override?.name}`,
        provider: override?.name ?? 'unknown',
        tokensOut: 10,
        tokensUsed: 10,
      };
    });

    const result = await runCompare({
      prompt: 'What is 2+2?',
      providers: ['fast', 'slow'],
    }, chatFn);

    expect(chatFn).toHaveBeenCalledTimes(2);
    expect(Math.abs(starts[0]! - starts[1]!)).toBeLessThan(15);
    expect(result.responses).toHaveLength(2);
  });

  it('one provider failure does not abort results from others', async () => {
    const chatFn = vi.fn(async (_messages, _tools, override) => {
      if (override?.name === 'bad') throw new Error('provider down');
      return {
        content: 'ok',
        provider: override?.name ?? 'good',
        tokensOut: 4,
        tokensUsed: 4,
      };
    });

    const result = await runCompare({
      prompt: 'test',
      providers: ['good', 'bad'],
    }, chatFn);

    expect(result.responses[0]?.response).toBe('ok');
    expect(result.responses[1]?.error).toMatch(/provider down/);
  });

  it('returns error for unconfigured provider without calling chat', async () => {
    const chatFn = vi.fn();
    const item = await queryProvider('missing', 'hello', undefined, 100, chatFn);
    expect(item.error).toMatch(/not configured/);
    expect(chatFn).not.toHaveBeenCalled();
  });

  it('blind mode labels hide provider IDs in output', () => {
    const result = {
      prompt: 'hello',
      generatedAt: new Date().toISOString(),
      responses: [
        {
          providerId: 'anthropic',
          model: 'claude',
          response: 'A',
          latencyMs: 100,
        },
        {
          providerId: 'groq',
          model: 'llama',
          response: 'B',
          latencyMs: 200,
        },
      ],
    };
    const text = formatCompareTerminal(result, true);
    expect(text).toContain('Provider A');
    expect(text).toContain('Provider B');
    expect(text).not.toContain('anthropic');
    expect(text).not.toContain('groq');
  });

  it('latency field is populated for every result', async () => {
    const chatFn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { content: 'x', provider: 'p', tokensOut: 1, tokensUsed: 1 };
    });

    const item = await queryProvider('p', 'q', undefined, 100, chatFn);
    expect(item.latencyMs).toBeGreaterThan(0);
  });
});

describe('/compare gateway command', () => {
  beforeEach(() => {
    vi.mocked(llm.chat).mockImplementation(async (_messages, _tools, override) => {
      const name = override?.name ?? 'unknown';
      if (name === 'bad') throw new Error('provider down');
      return {
        content: `answer from ${name}`,
        provider: name,
        tokensOut: 8,
        tokensUsed: 8,
      };
    });
  });

  it('returns both provider responses in one message', async () => {
    const result = await handleGatewayCommandAsync('/compare What is 2+2?', {
      sessionId: 'test-session',
      channel: 'telegram',
    });

    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).toContain('What is 2+2?');
    expect((result.reply.match(/answer from/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

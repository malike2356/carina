import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearTokenEfficiencyCaches,
  dedupeRagPassages,
  lookupExactResponse,
  maybeCompressPrompt,
  optimizeMessages,
  planRagBudget,
  storeExactResponse,
  storeSemanticResponse,
  trimToolResult,
} from './token-efficiency.js';
import type { Message } from '../types/index.js';

const now = new Date('2026-07-13T00:00:00.000Z');

function message(role: Message['role'], content: string): Message {
  return { role, content, timestamp: now };
}

describe('token efficiency', () => {
  beforeEach(() => {
    clearTokenEfficiencyCaches();
  });

  it('returns exact_cache_hit only inside the same tenant', () => {
    storeExactResponse({
      tenantId: 'tenant-a',
      prompt: 'How do I connect Slack?',
      response: 'Open Channels and connect Slack.',
    });

    const hit = optimizeMessages([message('user', 'How do I connect Slack?')], {
      tenantId: 'tenant-a',
      riskLevel: 'low',
    });
    const miss = lookupExactResponse('tenant-b', 'How do I connect Slack?');

    expect(hit.cacheHit?.kind).toBe('exact');
    expect(hit.records[0]?.kind).toBe('exact_cache_hit');
    expect(miss).toBeNull();
  });

  it('rejects semantic cache for sensitive or high-risk prompts', () => {
    storeSemanticResponse({
      tenantId: 'tenant-a',
      prompt: 'How do I connect Slack?',
      response: 'Open Channels and connect Slack.',
    });

    const result = optimizeMessages([message('user', 'My API key is sk-secret-value. How do I connect Slack?')], {
      tenantId: 'tenant-a',
      riskLevel: 'low',
      allowSemanticCache: true,
    });

    expect(result.cacheHit).toBeUndefined();
    expect(result.records[0]?.kind).toBe('none');
  });

  it('returns semantic_cache_hit for safe repeated tenant questions', () => {
    storeSemanticResponse({
      tenantId: 'tenant-a',
      prompt: 'How can I connect Slack to Carina channels?',
      response: 'Use Channels, Slack, Connect.',
    });

    const result = optimizeMessages([message('user', 'How can I connect Slack to Carina channels?')], {
      tenantId: 'tenant-a',
      riskLevel: 'low',
      allowSemanticCache: true,
    });

    expect(result.cacheHit?.kind).toBe('semantic');
    expect(result.records[0]?.kind).toBe('semantic_cache_hit');
  });

  it('compacts long conversation history to the requested context budget', () => {
    const messages = [
      message('system', 'You are Carina.'),
      ...Array.from({ length: 16 }, (_, index) => message(index % 2 === 0 ? 'user' : 'assistant', `Long context ${index} ${'detail '.repeat(260)}`)),
    ];

    const result = optimizeMessages(messages, {
      tenantId: 'tenant-a',
      maxInputTokens: 500,
    });

    expect(result.records.some((record) => record.kind === 'context_compacted')).toBe(true);
    expect(result.optimizedEstimatedInputTokens).toBeLessThan(result.rawEstimatedInputTokens);
  });

  it('trims tool results while retaining evidence links', () => {
    const original = `${'line '.repeat(1000)} https://example.com/evidence`;
    const trimmed = trimToolResult(original, 400);

    expect(trimmed.trimmed).toBe(true);
    expect(trimmed.content).toContain('https://example.com/evidence');
    expect(trimmed.content.length).toBeLessThan(original.length);
  });

  it('compresses only when savings exceed threshold', () => {
    const short = maybeCompressPrompt({ text: 'short text', enabled: true });
    const long = maybeCompressPrompt({
      text: 'Important context. '.repeat(1400),
      enabled: true,
      minSavingsTokens: 200,
    });

    expect(short.compressed).toBe(false);
    expect(long.compressed).toBe(true);
    expect(long.savedTokens).toBeGreaterThan(200);
  });

  it('deduplicates RAG passages and reports savings when budget trims context', () => {
    const passages = [
      'Carina connects Slack through Channels.',
      'Carina connects Slack through Channels.',
      'Aiva workers can receive task assignments.',
    ];

    expect(dedupeRagPassages(passages)).toHaveLength(2);
    const result = planRagBudget(['fixed'], passages, 3);
    expect(result.records[0]?.kind).toBe('context_compacted');
  });
});

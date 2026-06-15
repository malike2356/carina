import { describe, expect, it } from 'vitest';
import { PROVIDER_MAP } from './provider-registry.js';
import {
  detectReasoningEffort,
  detectStreamingCompatibility,
  streamingMatrixRows,
} from './provider-capability-detection.js';

describe('provider-capability-detection', () => {
  it('detects OpenAI o-series reasoning effort parameter', () => {
    const result = detectReasoningEffort('openai', 'o3-mini');
    expect(result.supported).toBe(true);
    expect(result.mode).toBe('openai-parameter');
    expect(result.levels).toContain('medium');
  });

  it('detects Anthropic thinking for Claude 4 models', () => {
    const result = detectReasoningEffort('anthropic', 'claude-sonnet-4-6');
    expect(result.supported).toBe(true);
    expect(result.mode).toBe('anthropic-thinking');
  });

  it('detects native reasoner models', () => {
    const result = detectReasoningEffort('deepseek', 'deepseek-reasoner');
    expect(result.supported).toBe(true);
    expect(result.mode).toBe('native-reasoner');
  });

  it('marks Gemini tool streaming as limited', () => {
    const gemini = PROVIDER_MAP.gemini!;
    const stream = detectStreamingCompatibility(gemini);
    expect(stream.text).toBe(true);
    expect(stream.tools).toBe(false);
    expect(stream.transport).toBe('google-generative');
  });

  it('marks Anthropic as streaming tools capable', () => {
    const anthropic = PROVIDER_MAP.anthropic!;
    const stream = detectStreamingCompatibility(anthropic);
    expect(stream.tools).toBe(true);
    expect(stream.transport).toBe('anthropic-messages');
  });

  it('streamingMatrixRows includes effort column data', () => {
    const rows = streamingMatrixRows([PROVIDER_MAP.openai!, PROVIDER_MAP.voyage!]);
    const openai = rows.find((row) => row.name === 'openai');
    const voyage = rows.find((row) => row.name === 'voyage');
    expect(openai?.streamTools).toBe(true);
    expect(openai?.reasoningEffort).toBe(true);
    expect(voyage?.stream).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatModelMetadataLine,
  getModelMetadata,
  isExpensiveModelTier,
} from './model-metadata.js';

describe('model metadata', () => {
  it('returns tier and context window for known models', () => {
    const meta = getModelMetadata('anthropic', 'claude-sonnet-4-20250514');
    expect(meta.tier).toBe('balanced');
    expect(meta.contextWindow).toBe(200_000);
    expect(meta.capabilities.tools).toBe(true);
  });

  it('marks premium tiers as expensive', () => {
    const meta = getModelMetadata('anthropic', 'claude-opus-4-20250514');
    expect(isExpensiveModelTier(meta.tier)).toBe(true);
  });

  it('formats a compact metadata line', () => {
    const line = formatModelMetadataLine(getModelMetadata('deepseek', 'deepseek-chat'));
    expect(line).toContain('deepseek/deepseek-chat');
    expect(line).toContain('tier=mini');
  });
});

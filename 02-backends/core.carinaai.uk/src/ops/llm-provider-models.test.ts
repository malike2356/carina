import { describe, expect, it } from 'vitest';
import { suggestedModelsForProvider } from './llm-provider-models.js';

describe('suggestedModelsForProvider', () => {
  it('returns expanded deepseek catalog', () => {
    const models = suggestedModelsForProvider('deepseek', 'deepseek-chat');
    expect(models).toContain('deepseek-chat');
    expect(models).toContain('deepseek-reasoner');
    expect(models).toContain('deepseek-v4-flash');
    expect(models[0]).toBe('deepseek-chat');
  });

  it('returns gemini catalog including 2.5 models', () => {
    const models = suggestedModelsForProvider('gemini');
    expect(models).toContain('gemini-2.5-flash');
    expect(models).toContain('gemini-2.0-flash');
  });

  it('returns at least the registry default for unknown curated providers', () => {
    const models = suggestedModelsForProvider('fireworks');
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.includes('llama') || m.includes('fireworks'))).toBe(true);
  });
});

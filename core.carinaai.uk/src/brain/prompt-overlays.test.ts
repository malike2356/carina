import { describe, expect, it } from 'vitest';
import { buildModelFamilyOverlay, resolveModelFamily } from './prompt-overlays.js';

describe('model-family prompt overlays', () => {
  it('resolves anthropic family from provider kind', () => {
    expect(resolveModelFamily('anthropic', 'claude-sonnet-4-20250514')).toBe('anthropic');
  });

  it('resolves reasoning family for premium models', () => {
    expect(resolveModelFamily('openai', 'o3-mini')).toBe('reasoning');
  });

  it('builds overlay text for gemini', () => {
    const overlay = buildModelFamilyOverlay('gemini', 'gemini-2.0-flash');
    expect(overlay).toContain('Model-family guidance (gemini)');
    expect(overlay).toContain('tool schemas');
  });

  it('adds anti-hallucination guidance for deepseek', () => {
    const overlay = buildModelFamilyOverlay('deepseek', 'deepseek-chat');
    expect(overlay).toContain('Do not hallucinate file contents');
    expect(overlay).toContain('verify deliverables before declaring DONE');
  });

  it('adds tool persistence guidance for openai-compatible models', () => {
    const overlay = buildModelFamilyOverlay('openai', 'gpt-4o');
    expect(overlay).toContain('retry on empty or partial tool output');
  });
});

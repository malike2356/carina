import { describe, expect, it } from 'vitest';
import { buildPlaygroundSystemPrompt } from '@/lib/workspace-llm';

describe('buildPlaygroundSystemPrompt', () => {
  it('includes thinking and tool guidance', () => {
    const prompt = buildPlaygroundSystemPrompt({
      systemPrompt: 'You are concise.',
      thinkingLevel: 'high',
      tools: {
        webSearch: true,
        codeExecution: true,
        structuredOutputs: true,
      },
    });

    expect(prompt).toContain('You are concise.');
    expect(prompt).toContain('Think carefully');
    expect(prompt).toContain('Web grounding is enabled');
    expect(prompt).toContain('Code execution preference is on');
    expect(prompt).toContain('Structured output is required');
  });

  it('uses a default persona when system prompt is empty', () => {
    const prompt = buildPlaygroundSystemPrompt({ thinkingLevel: 'off' });
    expect(prompt).toContain('Aiva Lab Playground');
    expect(prompt).toContain('Respond directly');
  });
});

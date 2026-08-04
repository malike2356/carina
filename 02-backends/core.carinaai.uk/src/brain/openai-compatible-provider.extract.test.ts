import { describe, expect, it } from 'vitest';
import { extractAssistantText } from './openai-compatible-provider.js';

describe('extractAssistantText', () => {
  it('prefers content when present', () => {
    expect(extractAssistantText({ content: 'hello', reasoning_content: 'think' })).toBe('hello');
  });

  it('falls back to reasoning_content when content empty', () => {
    expect(extractAssistantText({ content: '', reasoning_content: '  pong  ' })).toBe('pong');
    expect(extractAssistantText({ content: null, reasoning_content: 'pong' })).toBe('pong');
  });

  it('returns empty string when both missing', () => {
    expect(extractAssistantText(null)).toBe('');
    expect(extractAssistantText({})).toBe('');
  });
});

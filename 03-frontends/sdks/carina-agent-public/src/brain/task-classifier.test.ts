import { describe, expect, it } from 'vitest';
import { classifyComplexity } from './task-classifier.js';
import type { Message } from '../types/index.js';

function user(content: string): Message[] {
  return [{ role: 'user', content, timestamp: new Date() }];
}

describe('classifyComplexity', () => {
  it('routes short lookup-style requests to the cheap tier', () => {
    expect(classifyComplexity(user("What's my portfolio summary?"))).toBe('simple');
    expect(classifyComplexity(user('List my saved memories'))).toBe('simple');
  });

  it('routes analysis and strategy requests to the full-capability tier', () => {
    expect(classifyComplexity(user('Analyze this 50-page deal pack and compare three exit strategies.'))).toBe('complex');
    expect(classifyComplexity(user('Debug this implementation and write tests for the regression.'))).toBe('complex');
  });

  it('treats large context as complex even when the user prompt is short', () => {
    const messages: Message[] = [
      { role: 'system', content: 'context '.repeat(900), timestamp: new Date() },
      { role: 'user', content: 'Summarise it', timestamp: new Date() },
    ];
    expect(classifyComplexity(messages)).toBe('complex');
  });

  it('biases ambiguous multi-part requests toward complex', () => {
    expect(classifyComplexity(user('What changed? Why did it happen? What should I do next?'))).toBe('complex');
  });
});

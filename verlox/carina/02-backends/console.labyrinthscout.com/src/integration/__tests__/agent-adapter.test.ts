import { describe, expect, it } from 'vitest';
import { carinaAdapter } from '../adapters/carina-adapter.js';
import { externalAgentAdapter } from '../adapters/external-agent-adapter.js';
import { genericAdapter } from '../adapters/generic-adapter.js';
import { goalResultAdapter } from '../adapters/goal-result-adapter.js';
import { langChainAdapter } from '../adapters/langchain-adapter.js';
import { openAiAdapter } from '../adapters/openai-adapter.js';
import { resolveAdapter } from '../adapter-registry.js';

describe('agent adapters', () => {
  it('normalizes OpenAI chat requests and tool calls', () => {
    const request = openAiAdapter.parseRequest({
      messages: [{ role: 'user', content: 'hello' }],
      tools: [{ function: { name: 'search', arguments: '{"q":"x"}' } }],
      stream: true,
    });
    expect(request.prompt).toBe('hello');
    expect(request.toolCalls[0]?.name).toBe('search');
    expect(request.stream).toBe(true);
  });

  it('normalizes Carina gateway wire format', () => {
    const request = carinaAdapter.parseRequest({ sessionId: 's1', message: 'run task' });
    const response = carinaAdapter.parseResponse({ reply: 'done' });
    expect(request.sessionId).toBe('s1');
    expect(request.prompt).toBe('run task');
    expect(response.content).toBe('done');
  });

  it('normalizes generic and framework adapters', () => {
    expect(genericAdapter.parseRequest({ prompt: 'p' }).prompt).toBe('p');
    expect(externalAgentAdapter.parseRequest({ input: 'h' }).prompt).toBe('h');
    expect(goalResultAdapter.parseRequest({ goal: 'g' }).prompt).toBe('g');
    expect(langChainAdapter.parseResponse({ output: 'o' }).content).toBe('o');
  });

  it('resolves legacy agent type aliases', () => {
    expect(resolveAdapter('hermes').agentType).toBe('compat-agent');
    expect(resolveAdapter('openclaw').agentType).toBe('goal-result');
  });
});

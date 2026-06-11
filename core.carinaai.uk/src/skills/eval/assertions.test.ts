import { describe, expect, it } from 'vitest';
import { evaluateAssertion, evaluateFixture } from './assertions.js';
import type { EvalFixture } from './types.js';
import type { MatchedSkill } from './match.js';

const matched: MatchedSkill[] = [
  {
    name: 'notion-workspace',
    score: 5,
    description: 'Notion',
    trigger: ['notion'],
    steps: '1. Use API',
    toolsUsed: ['http-request'],
  },
  {
    name: 'google-workspace',
    score: 2,
    description: 'Google',
    trigger: ['gmail'],
    steps: '1. Use Gmail',
    toolsUsed: ['http-request', 'email-send'],
  },
];

describe('assertion evaluation', () => {
  it('passes skill_match when skill is present', () => {
    const result = evaluateAssertion(
      { type: 'skill_match', skill: 'notion-workspace' },
      { matchedSkills: matched, output: '', latencyMs: 5, tokensUsed: 0, queryKeywords: ['notion'] },
    );
    expect(result.passed).toBe(true);
  });

  it('fails skill_match when skill is missing', () => {
    const result = evaluateAssertion(
      { type: 'skill_match', skill: 'airtable-records' },
      { matchedSkills: matched, output: '', latencyMs: 5, tokensUsed: 0, queryKeywords: ['notion'] },
    );
    expect(result.passed).toBe(false);
  });

  it('checks skill_rank', () => {
    const pass = evaluateAssertion(
      { type: 'skill_rank', skill: 'notion-workspace', rank: 1 },
      { matchedSkills: matched, output: '', latencyMs: 5, tokensUsed: 0, queryKeywords: [] },
    );
    expect(pass.passed).toBe(true);

    const fail = evaluateAssertion(
      { type: 'skill_rank', skill: 'google-workspace', rank: 1 },
      { matchedSkills: matched, output: '', latencyMs: 5, tokensUsed: 0, queryKeywords: [] },
    );
    expect(fail.passed).toBe(false);
  });

  it('checks contains and not_contains on output', () => {
    const ctx = {
      matchedSkills: matched,
      output: 'Use the Notion API to update the page',
      latencyMs: 5,
      tokensUsed: 100,
      queryKeywords: ['notion'],
    };
    expect(evaluateAssertion({ type: 'contains', value: 'Notion API' }, ctx).passed).toBe(true);
    expect(evaluateAssertion({ type: 'not_contains', value: 'secret' }, ctx).passed).toBe(true);
    expect(evaluateAssertion({ type: 'matches_regex', pattern: 'Notion API' }, ctx).passed).toBe(true);
  });

  it('checks latency and token budgets', () => {
    const ctx = {
      matchedSkills: matched,
      output: '',
      latencyMs: 42,
      tokensUsed: 500,
      queryKeywords: [],
    };
    expect(evaluateAssertion({ type: 'max_latency_ms', value: '100' }, ctx).passed).toBe(true);
    expect(evaluateAssertion({ type: 'max_tokens', value: '1000' }, ctx).passed).toBe(true);
  });

  it('evaluates full fixture', () => {
    const fixture: EvalFixture = {
      id: 'test',
      input: { query: 'update notion' },
      assertions: [
        { type: 'skill_match', skill: 'notion-workspace' },
        { type: 'tools_include', skill: 'notion-workspace', tools: ['http-request'] },
      ],
    };
    const result = evaluateFixture(fixture, {
      matchedSkills: matched,
      output: '',
      latencyMs: 10,
      tokensUsed: 0,
      queryKeywords: ['notion'],
    });
    expect(result.pass).toBe(true);
  });
});

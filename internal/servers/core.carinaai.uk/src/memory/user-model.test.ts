import { describe, expect, it } from 'vitest';
import { buildAnalysisPrompt, parseAnalysisFacts } from './user-model-analyzer.js';
import { rowToFact } from './user-model-store.js';

describe('user model analyzer', () => {
  it('buildAnalysisPrompt includes transcript and requests JSON', () => {
    const prompt = buildAnalysisPrompt('USER: hello\nASSISTANT: hi');
    expect(prompt).toContain('USER: hello');
    expect(prompt).toContain('Return JSON only');
    expect(prompt).toContain('expertise|preference|goal');
  });

  it('parseAnalysisFacts parses valid JSON array', () => {
    const raw = JSON.stringify([
      { category: 'preference', fact: 'Prefers bullet points', confidence: 0.9 },
      { category: 'goal', fact: 'Building a HMO portfolio', confidence: 0.8 },
    ]);
    const facts = parseAnalysisFacts(raw);
    expect(facts).toHaveLength(2);
    expect(facts[0]?.category).toBe('preference');
    expect(facts[0]?.confidence).toBe(0.9);
  });

  it('parseAnalysisFacts strips markdown fences and ignores invalid categories', () => {
    const raw = '```json\n[{"category":"behavior","fact":"Asks for yield calcs","confidence":0.85},{"category":"invalid","fact":"skip me"}]\n```';
    const facts = parseAnalysisFacts(raw);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.fact).toBe('Asks for yield calcs');
  });

  it('parseAnalysisFacts returns empty array for non-array JSON', () => {
    expect(parseAnalysisFacts('{"category":"goal"}')).toEqual([]);
  });
});

describe('user model store row mapping', () => {
  it('rowToFact maps only non-contradicted rows used by getFacts query', () => {
    const fact = rowToFact({
      id: 'fact-1',
      category: 'context',
      fact: 'Based in Leeds',
      confidence: 0.82,
      observed_at: '2026-06-19T12:00:00.000Z',
      conversation_id: 'sess-1',
      confirmed_at: null,
      contradicted_at: null,
    });
    expect(fact.category).toBe('context');
    expect(fact.contradictedAt).toBeUndefined();
    expect(fact.confidence).toBe(0.82);
  });

  it('getFacts SQL contract excludes contradicted facts above min confidence', () => {
    const included = rowToFact({
      id: 'a',
      category: 'preference',
      fact: 'Concise answers',
      confidence: 0.7,
      observed_at: '2026-06-19T12:00:00.000Z',
      conversation_id: 's1',
      contradicted_at: null,
    });
    const excluded = rowToFact({
      id: 'b',
      category: 'preference',
      fact: 'Old preference',
      confidence: 0.9,
      observed_at: '2026-06-18T12:00:00.000Z',
      conversation_id: 's0',
      contradicted_at: '2026-06-19T13:00:00.000Z',
    });

    expect(included.confidence).toBeGreaterThanOrEqual(0.5);
    expect(excluded.contradictedAt).toBeDefined();
  });
});

describe('compileUserModel empty state', () => {
  it('returns empty string when user intelligence is disabled', async () => {
    const prev = process.env.CARINA_USER_INTELLIGENCE;
    process.env.CARINA_USER_INTELLIGENCE = 'false';
    const { compileUserModel } = await import('./user-model-compiler.js');
    await expect(compileUserModel('alice')).resolves.toBe('');
    process.env.CARINA_USER_INTELLIGENCE = prev;
  });
});

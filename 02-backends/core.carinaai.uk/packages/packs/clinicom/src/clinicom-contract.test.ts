import { describe, expect, it } from 'vitest';
import {
  dispatchClinicomTool,
  executeClinicomConfidenceExplain,
} from '../tools/handlers.js';

describe('clinicom contract v2', () => {
  it('dispatches deep ai routes', async () => {
    const result = await dispatchClinicomTool('confidence_explain', { score: 73 });
    expect(result).toMatchObject({ score: 73 });
  });

  it('dispatches product_help with deterministic grounding', async () => {
    const result = await dispatchClinicomTool('product_help', {
      question: 'What is Clinicom?',
      grounding_corpus: 'Clinicom AI is a Healthcare Communication Intelligence platform.',
      capabilities_summary: 'product_help:live',
    });
    expect(String(result.answer || '')).toContain('Clinicom');
    expect(result.grounded).toBe(true);
  });

  it('returns confidence explanations', async () => {
    const result = await executeClinicomConfidenceExplain({
      score: 81,
      provider_sources: { translation: 'carina' },
      pipeline_timing: { total: 0.4 },
    });
    expect(result).toMatchObject({ score: 81 });
    expect(result.source).toBeTruthy();
  });
});

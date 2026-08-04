import { describe, expect, it } from 'vitest';
import { routeLead } from './lead-router.js';

describe('lead-router', () => {
  it('never routes spam', () => {
    expect(routeLead({ classification: 'spam', text: 'check my channel', signals: [] })).toBe('none');
  });

  it('never routes cold leads', () => {
    expect(routeLead({ classification: 'cold_lead', text: 'nice video', signals: [] })).toBe('none');
  });

  it('routes investor language to joint venture calls', () => {
    const destination = routeLead({
      classification: 'warm_lead',
      text: 'Interested in a joint venture, what yield are you seeing?',
      signals: ['investor'],
    });
    expect(destination).toBe('joint_venture_calls');
  });

  it('routes beginner questions to the training pipeline', () => {
    const destination = routeLead({
      classification: 'warm_lead',
      text: 'How do I get started, I am new to this?',
      signals: ['question'],
    });
    expect(destination).toBe('training_pipeline');
  });

  it('routes sourcing language to the sourcing funnel', () => {
    const destination = routeLead({
      classification: 'hot_lead',
      text: 'Looking for a deal like this, is it still available?',
      signals: ['inquiry'],
    });
    expect(destination).toBe('sourcing_funnel');
  });

  it('defaults undirected warm/hot leads to the sourcing funnel', () => {
    const destination = routeLead({
      classification: 'hot_lead',
      text: 'DM me the details please',
      signals: ['cta'],
    });
    expect(destination).toBe('sourcing_funnel');
  });
});

import { describe, expect, it } from 'vitest';
import {
  cleanPlainText,
  isJunkSearchHit,
  scoreSearchHit,
  type ResearchFinding,
} from './research-filters.js';

describe('research-runner filters', () => {
  it('strips markdown and html from plain text', () => {
    expect(cleanPlainText('[Menu](https://example.com) * bold', 80)).toBe('Menu bold');
    expect(cleanPlainText('<p>Hello <strong>world</strong></p>', 80)).toBe('Hello world');
  });

  it('flags marketing and social hits as junk', () => {
    expect(
      isJunkSearchHit({
        title: 'The AI Agent Trends 2026 Report | Joseph Michael | 12 comments',
        url: 'https://www.linkedin.com/posts/example',
        description: 'Trend report with key takeaways',
      }),
    ).toBe(true);

    expect(
      isJunkSearchHit({
        title: 'State of AI Agent Security 2026 - Gravitee',
        url: 'https://www.gravitee.io/state-of-ai-agent-security',
        description: 'Industry report landing page',
      }),
    ).toBe(true);

    expect(
      isJunkSearchHit({
        title: 'AI Agent Event 2026',
        url: 'https://example.com/events/ai-agent-event-2026',
        description: 'Register now for the premier event',
      }),
    ).toBe(true);
  });

  it('keeps credible incident-shaped hits', () => {
    const hit = {
      title: 'Air Canada chatbot misquote leads to small claims court ruling',
      url: 'https://www.bbc.com/news/example-air-canada-chatbot',
      description: 'Court orders airline to honor fare quoted by its AI chatbot after customer lawsuit.',
    };
    expect(isJunkSearchHit(hit)).toBe(false);
    expect(scoreSearchHit(hit)).toBeGreaterThan(3);
  });

  it('does not treat every ordinary title as junk', () => {
    expect(
      isJunkSearchHit({
        title: 'Company discloses AI agent data breach',
        url: 'https://www.theregister.com/example-ai-agent-breach',
        description: 'Customer records were exposed after an autonomous workflow used the wrong connector.',
      }),
    ).toBe(false);
  });

  it('scores lawsuit and breach language higher', () => {
    const strong = scoreSearchHit({
      title: 'Firm fined after LLM data leak exposed customer records',
      url: 'https://www.theregister.com/example',
      description: 'Regulator issued fine after breach linked to an autonomous agent workflow.',
    });
    const weak = scoreSearchHit({
      title: 'What is an AI agent?',
      url: 'https://example.com/blog/what-is-an-ai-agent',
      description: 'Explainer article about agent architecture.',
    });
    expect(strong).toBeGreaterThan(weak);
  });
});

describe('research finding shape', () => {
  it('accepts minimal valid finding objects', () => {
    const finding: ResearchFinding = {
      title: 'Chatbot refund dispute',
      company: 'Example Air',
      damage: '$812 settlement',
      category: 'legal',
      dateOccurred: 'June 2026',
      bodyHtml: '<p>Summary</p>',
      sources: [{ label: 'BBC', url: 'https://example.com/story' }],
      scoutFixHtml: 'Require human approval for customer-facing commitments.',
    };
    expect(finding.sources[0]?.url.startsWith('https://')).toBe(true);
  });
});

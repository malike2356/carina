import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyseRoleDescription,
  finalizeRoleAnalysis,
  parseRoleAnalysisPayload,
  roleAnalyserLlmDisabled,
} from './role-analyser.js';
import { analyseRoleDescriptionHeuristic } from './role-analyser-heuristic.js';

const chatMock = vi.fn();

vi.mock('../brain/llm.js', () => ({
  llm: {
    chat: (...args: unknown[]) => chatMock(...args),
  },
}));

describe('role-analyser LLM', () => {
  beforeEach(() => {
    chatMock.mockReset();
    delete process.env.AIVA_ROLE_ANALYSER_DISABLE_LLM;
    delete process.env.AIVA_ROLE_ANALYSER_PROVIDER;
    delete process.env.AIVA_ROLE_ANALYSER_MODEL;
  });

  it('parses fenced JSON payloads and maps tiers from complexity', () => {
    const payload = parseRoleAnalysisPayload(
      `\`\`\`json
{
  "suggestedName": "Customer Support Agent",
  "domain": "customer_support",
  "responsibilities": ["Answer FAQs", "Escalate complex issues"],
  "requiredTools": ["email-read", "email-send", "spreadsheet-write"],
  "requiredSkills": ["faq-responses", "ticket-tracking"],
  "communicationChannels": ["email", "web_chat"],
  "complexity": "moderate",
  "confidenceScore": 0.92
}
\`\`\``,
      'Handle customer support emails.',
    );
    expect(payload).not.toBeNull();
    const result = finalizeRoleAnalysis(payload!, 'Handle customer support emails.');
    expect(result.domain).toBe('customer_support');
    expect(result.recommendedTier).toBe('growth');
    expect(result.roleTemplateId).toBe('customer-support');
    expect(result.confidenceScore).toBe(0.92);
  });

  it('uses the LLM response when available', async () => {
    chatMock.mockResolvedValue({
      content: JSON.stringify({
        suggestedName: 'Sales Outreach Agent',
        domain: 'sales_outreach',
        responsibilities: ['Qualify inbound leads', 'Book discovery calls'],
        requiredTools: ['email-read', 'email-send', 'crm-write'],
        requiredSkills: ['lead-qualification', 'follow-up-sequences'],
        communicationChannels: ['email'],
        complexity: 'moderate',
        confidenceScore: 0.88,
      }),
    });

    const result = await analyseRoleDescription(
      'Respond to inbound sales enquiries and qualify leads before booking calls.',
    );

    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(result.domain).toBe('sales_outreach');
    expect(result.suggestedName).toBe('Sales Outreach Agent');
    expect(result.recommendedTier).toBe('growth');
  });

  it('falls back to heuristics when the LLM response is invalid', async () => {
    chatMock.mockResolvedValue({ content: 'not json' });

    const result = await analyseRoleDescription(
      'I need someone to handle customer support emails, answer FAQs, and escalate complex issues.',
    );
    const expected = analyseRoleDescriptionHeuristic(
      'I need someone to handle customer support emails, answer FAQs, and escalate complex issues.',
    );

    expect(result.domain).toBe(expected.domain);
    expect(result.recommendedTier).toBe(expected.recommendedTier);
  });

  it('can force heuristic mode for tests', () => {
    process.env.AIVA_ROLE_ANALYSER_DISABLE_LLM = 'true';
    expect(roleAnalyserLlmDisabled()).toBe(true);
  });
});

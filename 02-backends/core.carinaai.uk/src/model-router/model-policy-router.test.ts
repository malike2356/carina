import { describe, expect, it } from 'vitest';
import { ModelPolicyRouter, type ModelPolicyContext } from './model-policy-router.js';
import type { Message, Tool } from '../types/index.js';

const now = new Date('2026-07-13T00:00:00.000Z');

function user(content: string): Message {
  return { role: 'user', content, timestamp: now };
}

function router(): ModelPolicyRouter {
  return new ModelPolicyRouter({
    freeMessageAllowance: 20,
    miniProvider: 'deepseek',
    miniModel: 'deepseek-chat',
    openaiProvider: 'openai',
    openaiModel: 'gpt-4o',
    claudeProvider: 'anthropic',
    claudeModel: 'claude-sonnet-4-6',
  });
}

function decide(overrides: Partial<ModelPolicyContext> = {}) {
  return router().decide({
    messages: [user('What is the status?')],
    ...overrides,
  });
}

describe('ModelPolicyRouter', () => {
  it('routes simple low-risk work to mini_or_local', () => {
    const decision = decide({ messages: [user('Summarise this in one sentence')] });

    expect(decision.allowed).toBe(true);
    expect(decision.tier).toBe('mini_or_local');
    expect(decision.selectedProvider).toBe('deepseek');
    expect(decision.selectedModel).toBe('deepseek-chat');
  });

  it('routes tool and action work to openai_action', () => {
    const tool: Tool = {
      name: 'send_email',
      description: 'Send an email',
      parameters: {},
      execute: async () => ({ ok: true }),
    };

    const decision = decide({
      messages: [user('Send this email to the client')],
      tools: [tool],
    });

    expect(decision.tier).toBe('openai_action');
    expect(decision.selectedProvider).toBe('openai');
    expect(decision.approvalRequired).toBe(false);
  });

  it('routes serious calculations and mission-critical work to claude_deep', () => {
    const decision = decide({
      messages: [user('Run a serious mathematical calculation for this mission critical projection')],
    });

    expect(decision.tier).toBe('claude_deep');
    expect(decision.selectedProvider).toBe('anthropic');
    expect(decision.approvalRequired).toBe(true);
  });

  it('does not route to Claude only because the prompt is long', () => {
    const longButSimple = `Please rewrite this politely.\n\n${'plain sentence '.repeat(1800)}`;

    const decision = decide({
      messages: [user(longButSimple)],
      taskType: 'rewrite',
      riskLevel: 'low',
    });

    expect(decision.tier).toBe('mini_or_local');
  });

  it('externalizes provider-cost enforcement for BYOK users', () => {
    const decision = decide({
      billingMode: 'byok',
      hasByok: true,
      budgetRemainingGbp: 0,
      messages: [user('Build and execute a workflow')],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain('BYOK is active');
    expect(decision.tier).toBe('openai_action');
  });

  it('downgrades safe free users to mini after allowance exhaustion', () => {
    const decision = decide({
      billingMode: 'free',
      usedAllowance: 20,
      messages: [user('What is new?')],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.tier).toBe('mini_or_local');
    expect(decision.downgradeMessage).toContain('free hosted allowance is finished');
  });

  it('hard stops free users after allowance when task cannot be safely downgraded', () => {
    const decision = decide({
      billingMode: 'free',
      remainingAllowance: 0,
      messages: [user('Execute this workflow and send the client emails')],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.subscriptionUpgradeRequired).toBe(true);
    expect(decision.budgetImpact).toBe('blocked');
  });

  it('warns subscription users before budget exhaustion', () => {
    const decision = decide({
      billingMode: 'subscription',
      userPlan: 'pro',
      budgetRemainingGbp: 0.0034,
      messages: [user('Calculate a serious mathematical projection')],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.warningMessage).toContain('close to the current plan budget');
  });

  it('records operator override as allowed and auditable', () => {
    const decision = decide({
      billingMode: 'subscription',
      adminOverride: true,
      budgetRemainingGbp: 0,
      messages: [user('Run a mission critical long persistent task')],
    });

    expect(decision.allowed).toBe(true);
    expect(decision.auditRequired).toBe(true);
    expect(decision.reason).toContain('Operator override');
  });
});

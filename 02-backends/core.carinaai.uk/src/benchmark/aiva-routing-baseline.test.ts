import { describe, expect, it } from 'vitest';
import { buildAivaRoutingBaseline, renderAivaRoutingBaselineMarkdown } from './aiva-routing-baseline.js';

describe('Aiva routing baseline', () => {
  it('does not claim an engine that did not execute', () => {
    const report = buildAivaRoutingBaseline({
      request: { tenantId: 'tenant-a', workspaceId: 'workspace-a', conversationId: 'conversation-a' },
      selected: { engine: 'keprix', provider: 'keprix', model: 'hermes' },
      execution: { provider: 'carina', model: 'carina-model', fallback: true, fallbackReason: 'keprix_timeout' },
    });
    expect(report.observation).toBe('not_observed');
    expect(report.execution.verified).toBe(false);
    expect(report.execution.handledByKeprix).toBe(false);
    expect(report.execution.fallbackReason).toBe('keprix_timeout');
  });

  it('keeps tenant scope explicit and verifies matching execution metadata', () => {
    const report = buildAivaRoutingBaseline({
      request: { tenantId: 'tenant-a', workspaceId: 'workspace-a', conversationId: 'conversation-a' },
      selected: { engine: 'keprix', provider: 'keprix', model: 'hermes', source: 'engine_policy' },
      execution: { provider: 'keprix', model: 'hermes', handledByKeprix: true },
      resources: { tools: ['contacts'], memorySources: ['session-summary'], retries: 1 },
    });
    expect(report.observation).toBe('observed');
    expect(report.execution.verified).toBe(true);
    expect(report.request.tenantId).toBe('tenant-a');
    expect(report.resources.tools).toEqual(['contacts']);
    expect(renderAivaRoutingBaselineMarkdown(report)).toContain('tenant-a');
  });

  it('redacts absent identifiers and resource details as not_observed', () => {
    const report = buildAivaRoutingBaseline();
    expect(report.request.tenantId).toBe('not_observed');
    expect(report.selected.provider).toBe('not_observed');
    expect(report.resources.promptBudget).toBeNull();
    expect(report.silentFailurePaths.length).toBeGreaterThan(0);
  });
});

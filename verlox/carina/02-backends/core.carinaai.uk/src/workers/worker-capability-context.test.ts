import { describe, expect, it } from 'vitest';
import {
  buildWorkerCapabilityContextSuffix,
  type WorkerRuntimeCapabilityContext,
} from './worker-capability-context.js';

describe('worker-capability-context', () => {
  it('web preview with connected LinkedIn includes approval inbox guidance', () => {
    const context: WorkerRuntimeCapabilityContext = {
      connectedChannels: ['linkedin'],
      disconnectedSocialChannels: ['instagram', 'messenger', 'twitter', 'tiktok'],
      socialApprovalRequired: true,
      socialAutoReplyEnabled: false,
      hasEnabledAutomations: true,
      isWebPreviewSession: true,
      activeChannel: 'web',
    };
    const suffix = buildWorkerCapabilityContextSuffix(context);
    expect(suffix).toContain('sessionMode: web_chat_preview');
    expect(suffix).toContain('connectedChannels: linkedin');
    expect(suffix).toContain('approval inbox');
    expect(suffix).toContain('Do not give a blanket refusal');
  });

  it('worker channel session with connected LinkedIn does not instruct blanket refusal', () => {
    const context: WorkerRuntimeCapabilityContext = {
      connectedChannels: ['linkedin', 'email'],
      disconnectedSocialChannels: ['instagram', 'messenger', 'twitter', 'tiktok'],
      socialApprovalRequired: true,
      socialAutoReplyEnabled: false,
      hasEnabledAutomations: false,
      isWebPreviewSession: false,
      activeChannel: 'linkedin',
    };
    const suffix = buildWorkerCapabilityContextSuffix(context);
    expect(suffix).toContain('sessionMode: worker_channel');
    expect(suffix).toContain('LinkedIn');
    expect(suffix).not.toMatch(/cannot monitor/i);
  });

  it('web preview with no connected channels points to Channels tab', () => {
    const context: WorkerRuntimeCapabilityContext = {
      connectedChannels: [],
      disconnectedSocialChannels: ['linkedin', 'instagram', 'messenger', 'twitter', 'tiktok'],
      socialApprovalRequired: true,
      socialAutoReplyEnabled: false,
      hasEnabledAutomations: false,
      isWebPreviewSession: true,
      activeChannel: 'web',
    };
    const suffix = buildWorkerCapabilityContextSuffix(context);
    expect(suffix).toContain('connectedChannels: none');
    expect(suffix).toContain('Channels tab');
  });
});

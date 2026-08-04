import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  isAivaSessionId,
  isHostLeakTool,
  isHostedMultiTenant,
  requireWorkspaceIdForHosted,
  workspaceScopedFileToken,
} from './tenant-isolation.js';

describe('tenant isolation', () => {
  const prevHosted = process.env.HOSTED_MODE;
  const prevOps = process.env.CARINA_OPS_PRODUCT_ENABLED;

  beforeEach(() => {
    delete process.env.HOSTED_MODE;
    delete process.env.CARINA_OPS_PRODUCT_ENABLED;
  });

  afterEach(() => {
    if (prevHosted === undefined) delete process.env.HOSTED_MODE;
    else process.env.HOSTED_MODE = prevHosted;
    if (prevOps === undefined) delete process.env.CARINA_OPS_PRODUCT_ENABLED;
    else process.env.CARINA_OPS_PRODUCT_ENABLED = prevOps;
  });

  it('detects aiva sessions and host leak tools', () => {
    expect(isAivaSessionId('aiva-abc-web-1')).toBe(true);
    expect(isAivaSessionId('main')).toBe(false);
    expect(isHostLeakTool('cronjob')).toBe(true);
    expect(isHostLeakTool('worker-automation')).toBe(false);
  });

  it('requires workspace id on hosted hosts', () => {
    process.env.HOSTED_MODE = 'true';
    expect(isHostedMultiTenant()).toBe(true);
    expect(requireWorkspaceIdForHosted(undefined).ok).toBe(false);
    expect(requireWorkspaceIdForHosted('cbfccc8e-5406-47b2-a325-edb107793043').ok).toBe(true);
  });

  it('uses full workspace uuid as file token', () => {
    const id = 'cbfccc8e-5406-47b2-a325-edb107793043';
    expect(workspaceScopedFileToken(id)).toBe(id);
  });
});

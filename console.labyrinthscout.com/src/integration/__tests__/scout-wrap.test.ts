import { afterEach, describe, expect, it, vi } from 'vitest';
import { scoutWrap } from '../scout-wrap.js';
import { resetScoutPipelineDeps } from '../security-pipeline.js';
import { resetContextFirewallDeps, setContextFirewallDeps } from '../../security/context-firewall.js';
import { resetPolicyGatewayDeps, setPolicyGatewayDeps } from '../../security/policy-gateway.js';

describe('scoutWrap', () => {
  afterEach(() => {
    resetScoutPipelineDeps();
    resetContextFirewallDeps();
    resetPolicyGatewayDeps();
  });

  it('intercepts nested SDK methods and calls through when allowed', async () => {
    const create = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = scoutWrap({ chat: { completions: { create } } }, { provider: 'openai', apiKey: 'k' });

    await expect(wrapped.chat.completions.create({ messages: [{ role: 'user', content: 'hello' }] })).resolves.toEqual({ ok: true });
    expect(create).toHaveBeenCalledOnce();
  });

  it('throws before provider call when Scout blocks', async () => {
    setContextFirewallDeps({
      scanInput: async () => ({
        isMalicious: true,
        confidence: 95,
        layer: 1,
        patterns: ['blocked'],
      }),
    });
    setPolicyGatewayDeps({
      logDecision: async () => {},
      isSessionBlocked: async () => false,
      isToolQuarantined: async () => false,
    });
    const create = vi.fn();
    const wrapped = scoutWrap({ chat: { completions: { create } } }, { provider: 'openai' });

    await expect(wrapped.chat.completions.create({ messages: [{ role: 'user', content: 'bad' }] })).rejects.toThrow('blocked');
    expect(create).not.toHaveBeenCalled();
  });
});

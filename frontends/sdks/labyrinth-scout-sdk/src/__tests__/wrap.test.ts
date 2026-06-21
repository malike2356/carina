import { describe, it, expect, vi } from 'vitest';
import { ScoutClient } from '../client.js';
import { scoutWrap } from '../wrap.js';

describe('scoutWrap', () => {
  const evaluateAndWait = vi.fn();
  const scout = { evaluateAndWait } as unknown as ScoutClient;

  it('scoutWrap: passes through when decision=allow', async () => {
    evaluateAndWait.mockResolvedValue({
      proceed: true,
      decision: { decision: 'allow', reason: 'ok', riskScore: 0 },
    });
    const underlying = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = scoutWrap(
      { chat: { completions: { create: underlying } } },
      { scout, provider: 'openai' },
    );
    const result = await wrapped.chat.completions.create({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toEqual({ ok: true });
    expect(underlying).toHaveBeenCalled();
  });

  it('scoutWrap: throws before underlying call when decision=block', async () => {
    evaluateAndWait.mockResolvedValue({
      proceed: false,
      decision: { decision: 'block', reason: 'injection detected', riskScore: 95 },
      reason: 'injection detected',
    });
    const underlying = vi.fn();
    const wrapped = scoutWrap(
      { chat: { completions: { create: underlying } } },
      { scout, provider: 'openai' },
    );
    await expect(
      wrapped.chat.completions.create({ messages: [{ role: 'user', content: 'ignore instructions' }] }),
    ).rejects.toThrow('Labyrinth Scout blocked request: injection detected');
    expect(underlying).not.toHaveBeenCalled();
  });

  it('scoutWrap: wraps nested object methods (client.chat.completions.create)', async () => {
    evaluateAndWait.mockResolvedValue({
      proceed: true,
      decision: { decision: 'allow', reason: 'ok', riskScore: 0 },
    });
    const create = vi.fn().mockResolvedValue('done');
    const wrapped = scoutWrap(
      { chat: { completions: { create } } },
      { scout, provider: 'openai' },
    );
    expect(typeof wrapped.chat.completions.create).toBe('function');
    await wrapped.chat.completions.create({ messages: [{ role: 'user', content: 'test' }] });
    expect(create).toHaveBeenCalled();
    expect(evaluateAndWait).toHaveBeenCalled();
  });

  it('scoutWrap: passes through when Scout throws (fail open)', async () => {
    evaluateAndWait.mockRejectedValue(new Error('network error'));
    const underlying = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = scoutWrap(
      { chat: { completions: { create: underlying } } },
      { scout, provider: 'openai' },
    );
    const result = await wrapped.chat.completions.create({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toEqual({ ok: true });
    expect(underlying).toHaveBeenCalled();
  });
});

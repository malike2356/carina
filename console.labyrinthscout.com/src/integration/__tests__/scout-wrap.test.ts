import { afterEach, describe, expect, it, vi } from 'vitest';
import { scoutWrap } from '../scout-wrap.js';
import { resetScoutPipelineDeps, setScoutPipelineDeps } from '../security-pipeline.js';

describe('scoutWrap', () => {
  afterEach(() => resetScoutPipelineDeps());

  it('intercepts nested SDK methods and calls through when allowed', async () => {
    const create = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = scoutWrap({ chat: { completions: { create } } }, { provider: 'openai', apiKey: 'k' });

    await expect(wrapped.chat.completions.create({ messages: [{ role: 'user', content: 'hello' }] })).resolves.toEqual({ ok: true });
    expect(create).toHaveBeenCalledOnce();
  });

  it('throws before provider call when Scout blocks', async () => {
    setScoutPipelineDeps({ scanUserMessage: async () => ({ blocked: true, reason: 'blocked' }) });
    const create = vi.fn();
    const wrapped = scoutWrap({ chat: { completions: { create } } }, { provider: 'openai' });

    await expect(wrapped.chat.completions.create({ messages: [{ role: 'user', content: 'bad' }] })).rejects.toThrow('blocked');
    expect(create).not.toHaveBeenCalled();
  });
});

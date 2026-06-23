import { describe, expect, it, vi } from 'vitest';

const callAuxiliaryModel = vi.fn();

vi.mock('../brain/auxiliary-client.js', () => ({
  callAuxiliaryModel: (...args: unknown[]) => callAuxiliaryModel(...args),
}));

describe('session-titles', () => {
  it('generateSessionTitle uses auxiliary model output', async () => {
    callAuxiliaryModel.mockResolvedValue('Quarterly planning notes');
    const { generateSessionTitle } = await import('./session-titles.js');
    const title = await generateSessionTitle('Help me plan the quarterly roadmap for Carina');
    expect(title).toBe('Quarterly planning notes');
    expect(callAuxiliaryModel).toHaveBeenCalledWith(
      'titleGeneration',
      expect.stringContaining('Help me plan'),
    );
  });

  it('generateSessionTitle falls back when auxiliary call fails', async () => {
    callAuxiliaryModel.mockRejectedValue(new Error('offline'));
    const { generateSessionTitle } = await import('./session-titles.js');
    const msg = 'Short title request';
    const title = await generateSessionTitle(msg);
    expect(title).toBe(msg);
  });
});

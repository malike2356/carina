import { describe, expect, it } from 'vitest';
import { handleGatewayCommand, handleGatewayCommandAsync } from './commands.js';

describe('gateway help command', () => {
  it('includes the capabilities docs link', () => {
    const result = handleGatewayCommand('/help');

    expect(result.handled).toBe(true);
    if (!result.handled) return;

    expect(result.reply).toContain('https://carinaai.uk/docs/capabilities');
    expect(result.reply).toContain('/model [provider] [model]');
    expect(result.reply).toContain('/clear - clear session memory');
  });

  it('returns compact help on telegram', () => {
    const result = handleGatewayCommand('/help', {}, { channel: 'telegram' });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).toContain('/new');
    expect(result.reply).not.toContain('https://carinaai.uk/docs/capabilities');
  });

  it('handles /new and /stop actions', async () => {
    expect(handleGatewayCommand('/new').action).toBe('new_session');
    const stop = await handleGatewayCommandAsync('/stop');
    expect(stop.handled).toBe(true);
    if (stop.handled) {
      expect(stop.action).toBe('stop_turn');
    }
  });

  it('returns status payload async', async () => {
    const result = await handleGatewayCommandAsync('/status', {
      sessionId: 'sess-abc',
      channel: 'discord',
      activeProvider: 'anthropic',
      activeModel: 'claude-sonnet-4-6',
    });
    expect(result.handled).toBe(true);
    if (!result.handled) return;
    expect(result.reply).toContain('anthropic');
    expect(result.reply).toContain('Continuity:');
  });

  it('handles /plan on, status, and off', async () => {
    const ctx = { sessionId: 'sess-plan', channel: 'web' as const };
    const on = await handleGatewayCommandAsync('/plan on', ctx);
    expect(on.handled).toBe(true);
    if (on.handled) expect(on.reply).toContain('Plan mode ON');

    const status = await handleGatewayCommandAsync('/plan status', ctx);
    expect(status.handled).toBe(true);
    if (status.handled) expect(status.reply).toContain('Plan mode: ON');

    const off = await handleGatewayCommandAsync('/plan off', ctx);
    expect(off.handled).toBe(true);
    if (off.handled) expect(off.reply).toContain('Plan mode OFF');
  });
});

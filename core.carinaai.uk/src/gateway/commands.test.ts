import { describe, expect, it } from 'vitest';
import { handleGatewayCommand } from './commands.js';

describe('gateway help command', () => {
  it('includes the capabilities docs link', () => {
    const result = handleGatewayCommand('/help');

    expect(result.handled).toBe(true);
    if (!result.handled) return;

    expect(result.reply).toContain('https://carinaai.uk/docs/capabilities');
    expect(result.reply).toContain('/model [provider] [model]');
    expect(result.reply).toContain('/clear - fresh start');
  });
});

import { describe, expect, it } from 'vitest';
import { carinaTelegramMenuCommands } from '../../telegram-menu.js';
import './index.js';

describe('Carina Telegram menu commands', () => {
  it('includes voice, config, and byok from the slash registry', () => {
    const commands = carinaTelegramMenuCommands().map((c) => c.command);
    expect(commands).toContain('voice');
    expect(commands).toContain('voice_on');
    expect(commands).toContain('voice_off');
    expect(commands).toContain('config');
    expect(commands).toContain('byok');
    expect(commands).toContain('help');
    expect(commands).toContain('start');
  });
});

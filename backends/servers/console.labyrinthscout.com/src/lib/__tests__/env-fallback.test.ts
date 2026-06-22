import { afterEach, describe, expect, it } from 'vitest';
import { firstEnvValue } from './env-fallback.js';

describe('firstEnvValue', () => {
  afterEach(() => {
    delete process.env.SCOUT_TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it('skips blank SCOUT_* values and falls back to TELEGRAM_*', () => {
    process.env.SCOUT_TELEGRAM_BOT_TOKEN = '';
    process.env.TELEGRAM_BOT_TOKEN = 'real-token';
    expect(firstEnvValue('SCOUT_TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN')).toBe('real-token');
  });

  it('prefers the first non-empty value', () => {
    process.env.SCOUT_TELEGRAM_BOT_TOKEN = ' scout-token ';
    process.env.TELEGRAM_BOT_TOKEN = 'legacy-token';
    expect(firstEnvValue('SCOUT_TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN')).toBe('scout-token');
  });
});

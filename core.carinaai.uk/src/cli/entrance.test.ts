import { describe, expect, it } from 'vitest';
import {
  buildCommandFooter,
  buildEntranceLines,
  buildFreshStartLines,
  buildHelpFooterText,
  commandHintsFor,
  formatEntranceBlock,
  type EntranceSnapshot,
} from './entrance.js';

const baseSnapshot: EntranceSnapshot = {
  profile: 'work',
  provider: 'deepseek',
  model: 'deepseek-chat',
  toolCount: 27,
  scoutSecured: true,
  memoryReady: true,
  surface: 'cli',
};

describe('CLI entrance', () => {
  it('builds a compact startup banner', () => {
    const lines = buildEntranceLines(baseSnapshot);
    expect(lines).toEqual([
      'CARINA',
      'Direct operator agent · Scout-secured',
      'profile: work · provider: deepseek · deepseek-chat',
      'tools: 27 · fast path ready',
    ]);
  });

  it('shows standalone when Scout is disabled', () => {
    const lines = buildEntranceLines({ ...baseSnapshot, scoutSecured: false });
    expect(lines[1]).toBe('Direct operator agent · standalone');
  });

  it('shows chat-only memory status when memory is unavailable', () => {
    const lines = buildEntranceLines({ ...baseSnapshot, memoryReady: false });
    expect(lines[3]).toBe('tools: 27 · memory: chat-only');
  });

  it('builds a minimal fresh-start screen', () => {
    const lines = buildFreshStartLines(baseSnapshot);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Fresh start');
    expect(lines[1]).toContain('profile: work');
  });

  it('uses surface-specific command hints', () => {
    expect(commandHintsFor('cli')).toEqual(['/help', '/model', '/clear', '/exit']);
    expect(commandHintsFor('tui')).toEqual(['/help', '/profile', '/provider', '/quit']);
    expect(buildHelpFooterText('tui')).toContain('/profile');
  });

  it('keeps footer compact on narrow terminals', () => {
    const footer = buildCommandFooter('cli', 40);
    expect(footer).toBe('/help  /model  /clear  /exit');
    expect(footer.length).toBeLessThanOrEqual(40);
  });

  it('truncates long provider labels for narrow layouts', () => {
    const lines = buildEntranceLines({
      ...baseSnapshot,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4-20250514-with-extra-suffix',
    });
    expect(lines[2].length).toBeLessThan(120);
    expect(lines[2]).toContain('…');
  });

  it('formats startup block with footer', () => {
    const block = formatEntranceBlock(baseSnapshot, 'startup');
    expect(block).toContain('CARINA');
    expect(block).toContain('/help');
    expect(block).toContain('/exit');
  });
});

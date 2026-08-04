import { afterEach, describe, expect, it } from 'vitest';
import { handleAmbientSlashCommand } from './ambient-slack-commands.js';
import {
  getAmbientChannelSettings,
  resetAmbientChannelSettingsForTests,
} from './ambient-channel-settings.js';

describe('ambient slash commands', () => {
  afterEach(() => {
    resetAmbientChannelSettingsForTests();
  });

  it('enables ambient mode with /ambient on', async () => {
    const reply = await handleAmbientSlashCommand({
      channelId: 'C1',
      channelName: '#eng',
      text: 'on',
      userId: 'U1',
    });
    expect(reply).toContain('enabled');
    const settings = await getAmbientChannelSettings('C1');
    expect(settings.ambientChecksEnabled).toBe(true);
  });

  it('respects /ambient quiet command', async () => {
    const reply = await handleAmbientSlashCommand({
      channelId: 'C1',
      channelName: '#eng',
      text: 'quiet 4h',
      userId: 'U1',
    });
    expect(reply).toContain('snoozed');
    const settings = await getAmbientChannelSettings('C1');
    expect(settings.quietUntil).not.toBeNull();
  });
});

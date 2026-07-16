import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../config/index.js';
import { isChannelAllowedForAmbient, isSlackAmbientEnabled } from './channel-access.js';

describe('channel access', () => {
  const previous = { ...config.ambient };

  afterEach(() => {
    Object.assign(config.ambient, previous);
    config.ambient.slack = { ...previous.slack };
  });

  it('returns false when ambient mode is disabled', () => {
    config.ambient.enabled = false;
    expect(isSlackAmbientEnabled()).toBe(false);
    expect(isChannelAllowedForAmbient('C1', '#engineering')).toBe(false);
  });

  it('excludes blocked channels', () => {
    config.ambient.enabled = true;
    config.ambient.slack.passiveReading = true;
    config.ambient.slack.excludeChannels = ['C_EXEC', '#exec'];
    expect(isChannelAllowedForAmbient('C_EXEC')).toBe(false);
    expect(isChannelAllowedForAmbient('C1', '#exec')).toBe(false);
    expect(isChannelAllowedForAmbient('C1', '#engineering')).toBe(true);
  });

  it('respects allowlist when configured', () => {
    config.ambient.enabled = true;
    config.ambient.slack.passiveReading = true;
    config.ambient.slack.allowedChannels = ['C1'];
    config.ambient.slack.excludeChannels = [];
    expect(isChannelAllowedForAmbient('C1')).toBe(true);
    expect(isChannelAllowedForAmbient('C2')).toBe(false);
  });
});

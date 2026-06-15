import { describe, expect, it, beforeEach } from 'vitest';
import os from 'os';
import path from 'path';

const tmpHome = path.join(os.tmpdir(), `carina-dm-irc-${process.pid}`);

describe('dm-pairing irc', () => {
  beforeEach(() => {
    process.env.CARINA_HOME = tmpHome;
    process.env.CARINA_CHANNEL_DM_PAIRING = 'true';
  });

  it('includes irc in DM pairing channels', async () => {
    const { channelDmPairingEnabled, resetDmPairingCache } = await import('./dm-pairing.js');
    resetDmPairingCache();
    expect(channelDmPairingEnabled('irc')).toBe(true);
    expect(channelDmPairingEnabled('irc')).toBe(true);
  });
});

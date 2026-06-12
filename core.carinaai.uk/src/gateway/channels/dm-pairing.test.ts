import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('channel DM pairing', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-dm-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('CARINA_CHANNEL_DM_PAIRING', 'true');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('blocks unknown peers and allows after approval', async () => {
    const {
      checkDmAllowed,
      approveDmPeer,
      revokeDmPeer,
      rotateDmPeerToken,
    } = await import('./dm-pairing.js');

    const blocked = checkDmAllowed('telegram', 'user-99', true);
    expect(blocked.allowed).toBe(false);
    expect(blocked.pending).toBe(true);

    approveDmPeer('telegram', 'user-99');
    expect(checkDmAllowed('telegram', 'user-99', true).allowed).toBe(true);

    const token = rotateDmPeerToken('telegram', 'user-99');
    expect(token).toMatch(/^[a-f0-9]{32}$/);

    revokeDmPeer('telegram', 'user-99');
    expect(checkDmAllowed('telegram', 'user-99', true).allowed).toBe(false);
  });

  it('skips pairing when feature disabled', async () => {
    vi.stubEnv('CARINA_CHANNEL_DM_PAIRING', 'false');
    vi.resetModules();
    const { checkDmAllowed } = await import('./dm-pairing.js');
    expect(checkDmAllowed('telegram', 'anyone', true).allowed).toBe(true);
  });

  it('respects per-channel opt-out', async () => {
    vi.stubEnv('CARINA_TELEGRAM_DM_PAIRING', 'false');
    vi.resetModules();
    const { channelDmPairingEnabled, checkDmAllowed } = await import('./dm-pairing.js');
    expect(channelDmPairingEnabled('telegram')).toBe(false);
    expect(checkDmAllowed('telegram', 'user-1', true).allowed).toBe(true);
  });
});

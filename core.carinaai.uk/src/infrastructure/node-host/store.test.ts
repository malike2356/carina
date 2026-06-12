import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('node-host store', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-node-'));
    vi.resetModules();
    process.env.CARINA_HOME = tmp;
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function store() {
    return import('./store.js');
  }

  it('pairing lifecycle: request, approve, claim, revoke', async () => {
    const mod = await store();
    const pending = mod.addPendingPairing({
      name: 'build-1',
      hostname: 'build-1.local',
      platform: 'linux',
    });
    expect(pending.code).toMatch(/^[A-F0-9]{6}$/);

    const approved = mod.approvePendingPairing(pending.id);
    expect(approved?.id).toBe(pending.id);
    expect(mod.listPendingPairings()).toHaveLength(0);

    const claimed = mod.claimApprovedNodePairing(pending.id, pending.code);
    expect(claimed?.token).toMatch(/^cnh_/);
    expect(mod.validateNodeToken(claimed!.token)?.name).toBe('build-1');

    expect(mod.revokePairedNode(pending.id)).toBe(true);
    expect(mod.validateNodeToken(claimed!.token)).toBeNull();
  });

  it('rejects claim with wrong code', async () => {
    const mod = await store();
    const pending = mod.addPendingPairing({
      name: 'n1',
      hostname: 'h1',
      platform: 'linux',
    });
    mod.approvePendingPairing(pending.id);
    expect(mod.claimApprovedNodePairing(pending.id, 'BAD000')).toBeNull();
  });

  it('rotates node token and invalidates old token', async () => {
    const mod = await store();
    const pending = mod.addPendingPairing({ name: 'n', hostname: 'h', platform: 'linux' });
    mod.approvePendingPairing(pending.id);
    const { token } = mod.claimApprovedNodePairing(pending.id, pending.code)!;
    const rotated = mod.rotateNodeToken(pending.id);
    expect(rotated?.token).toMatch(/^cnh_/);
    expect(mod.validateNodeToken(token)).toBeNull();
    expect(mod.validateNodeToken(rotated!.token)).not.toBeNull();
  });

  it('queues and completes commands', async () => {
    const mod = await store();
    const pending = mod.addPendingPairing({ name: 'n', hostname: 'h', platform: 'linux' });
    mod.approvePendingPairing(pending.id);
    const { token } = mod.claimApprovedNodePairing(pending.id, pending.code)!;
    expect(token).toBeTruthy();

    const cmd = mod.enqueueNodeCommand(pending.id, 'ping', {});
    const polled = mod.pollNodeCommands(pending.id);
    expect(polled).toHaveLength(1);
    expect(mod.completeNodeCommand(cmd.id, pending.id, { pong: true })).toBe(true);
    expect(mod.pollNodeCommands(pending.id)).toHaveLength(0);
  });

  it('waitForNodeCommand resolves when command completes', async () => {
    const mod = await store();
    const pending = mod.addPendingPairing({ name: 'n', hostname: 'h', platform: 'linux' });
    mod.approvePendingPairing(pending.id);
    mod.claimApprovedNodePairing(pending.id, pending.code);
    const cmd = mod.enqueueNodeCommand(pending.id, 'ping', {});
    setTimeout(() => {
      mod.completeNodeCommand(cmd.id, pending.id, { pong: true });
    }, 50);
    const finished = await mod.waitForNodeCommand(cmd.id, 2000);
    expect(finished?.result).toMatchObject({ pong: true });
  });

  it('persists local node host config', async () => {
    const mod = await store();
    mod.writeNodeHostConfig({
      gatewayUrl: 'http://localhost:3000',
      nodeId: 'abc',
      token: 'cnh_test',
      name: 'node',
    });
    const cfg = mod.readNodeHostConfig();
    expect(cfg?.nodeId).toBe('abc');
    mod.clearNodeHostConfig();
    expect(mod.readNodeHostConfig()).toBeNull();
  });
});

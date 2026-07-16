import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChannelMessage } from './channel-adapter.interface.js';

function sampleInbound(overrides: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    id: 'm1',
    channel: 'discord',
    externalUserId: 'u1',
    conversationId: 'c1',
    text: 'hello',
    timestamp: new Date(),
    isDirect: true,
    isMention: true,
    isCommand: false,
    ...overrides,
  };
}

describe('inbound guards', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-guard-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.unstubAllEnvs();
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('passes through when both features disabled', async () => {
    delete process.env.CARINA_THREAD_OWNERSHIP;
    delete process.env.CARINA_CHANNEL_DM_PAIRING;
    vi.resetModules();
    const { guardInboundMessage } = await import('./inbound-guards.js');
    expect(guardInboundMessage(sampleInbound(), 'agent-a').allow).toBe(true);
  });

  it('blocks unapproved DM when pairing enabled', async () => {
    vi.stubEnv('CARINA_CHANNEL_DM_PAIRING', 'true');
    vi.resetModules();
    const { guardInboundMessage } = await import('./inbound-guards.js');
    const result = guardInboundMessage(sampleInbound({ channel: 'telegram' }), 'agent-a');
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.code).toBe('dm_blocked');
  });

  it('blocks second agent when thread ownership enabled', async () => {
    vi.stubEnv('CARINA_THREAD_OWNERSHIP', 'true');
    vi.stubEnv('CARINA_INSTANCE_ID', 'inst-1');
    vi.resetModules();
    const { guardInboundMessage } = await import('./inbound-guards.js');
    const msg = sampleInbound({ channel: 'slack', isDirect: false, threadId: 't1' });
    expect(guardInboundMessage(msg, 'agent-a').allow).toBe(true);
    const blocked = guardInboundMessage(msg, 'agent-b');
    expect(blocked.allow).toBe(false);
    if (!blocked.allow) expect(blocked.code).toBe('thread_owned');
  });

  it('includes irc in ownership channels when enabled', async () => {
    vi.stubEnv('CARINA_THREAD_OWNERSHIP', 'true');
    vi.stubEnv('CARINA_INSTANCE_ID', 'inst-1');
    vi.resetModules();
    const { guardInboundMessage } = await import('./inbound-guards.js');
    const msg = sampleInbound({ channel: 'irc', isDirect: false, conversationId: '#carina', threadId: 'root' });
    expect(guardInboundMessage(msg, 'agent-a').allow).toBe(true);
    expect(guardInboundMessage(msg, 'agent-b').allow).toBe(false);
  });
});

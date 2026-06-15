import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { AgentsConfig } from './types.js';
import type { ChannelMessage } from '../gateway/channels/channel-adapter.interface.js';
import {
  resolveInboundAgentRoute,
  resolveOwnershipRoute,
  shouldHandOffToOwner,
} from './inbound-routing.js';
import {
  handoffThreadOwnership,
  resetThreadOwnershipCache,
  tryAcquireThreadOwnership,
} from '../gateway/channels/thread-ownership.js';

const config: AgentsConfig = {
  version: 1,
  agents: [
    { id: 'main', name: 'Main', default: true, workspace: '/tmp/ws-main' },
    { id: 'work', name: 'Work', workspace: '/tmp/ws-work' },
  ],
  bindings: [
    { agentId: 'work', match: { channel: 'telegram' } },
    { agentId: 'main', match: { channel: '*' } },
  ],
};

function inbound(partial: Partial<ChannelMessage> = {}): ChannelMessage {
  return {
    id: 'msg-1',
    channel: 'telegram',
    conversationId: 'chat-1',
    externalUserId: 'user-1',
    text: 'hello',
    timestamp: new Date(),
    isDirect: true,
    isMention: false,
    chatType: 'direct',
    ...partial,
  };
}

describe('inbound routing', () => {
  let tmpHome = '';

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-route-'));
    process.env.CARINA_HOME = tmpHome;
    resetThreadOwnershipCache();
    process.env.CARINA_THREAD_OWNERSHIP = 'true';
    process.env.CARINA_INSTANCE_ID = 'test-instance';
  });

  afterEach(async () => {
    delete process.env.CARINA_HOME;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('routes owned threads to the owner agent instead of binding', async () => {
    tryAcquireThreadOwnership({
      channel: 'telegram',
      conversationId: 'chat-1',
      threadId: 'dm',
      agentId: 'main',
    });

    const route = await resolveInboundAgentRoute(inbound(), config);
    expect(route.agent.id).toBe('main');
    expect(route.source).toBe('ownership');
    expect(route.handoffFromAgentId).toBe('work');
  });

  it('uses binding when thread is not owned', async () => {
    const route = await resolveInboundAgentRoute(inbound(), config);
    expect(route.agent.id).toBe('work');
    expect(route.source).toBe('binding');
  });

  it('follows handoff to the new owner on subsequent messages', () => {
    const owned = tryAcquireThreadOwnership({
      channel: 'telegram',
      conversationId: 'chat-1',
      threadId: 'dm',
      agentId: 'work',
    });
    if (!owned.ok) throw new Error(owned.reason);
    handoffThreadOwnership(owned.record.key, 'main', 'operator handoff');

    const route = resolveOwnershipRoute(inbound(), config);
    expect(route?.agent.id).toBe('main');
    expect(shouldHandOffToOwner('work', 'main')).toBe(true);
  });

  it('prefers contact binding over account binding', async () => {
    const contactConfig: AgentsConfig = {
      ...config,
      agents: [
        ...config.agents,
        { id: 'vip', name: 'VIP', workspace: '/tmp/ws-vip' },
      ],
      bindings: [
        { agentId: 'vip', match: { channel: 'whatsapp', contactId: 'contact-vip' } },
        { agentId: 'work', match: { channel: 'whatsapp', accountId: 'biz' } },
      ],
    };

    const { resolveAgentRoute } = await import('./agent-routing.js');
    const route = resolveAgentRoute({
      channel: 'whatsapp',
      accountId: 'biz',
      contactId: 'contact-vip',
      peerKind: 'direct',
      peerId: '+15551230001',
    }, contactConfig);

    expect(route.agent.id).toBe('vip');
    expect(route.tier).toBe('contact');
  });
});

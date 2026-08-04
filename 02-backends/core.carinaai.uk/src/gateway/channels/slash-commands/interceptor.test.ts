import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('./registry.js', () => {
  const helpHandler = vi.fn(async () => '/help response');
  const newHandler = vi.fn(async () => 'Fresh conversation started. Previous context cleared.');
  const statusHandler = vi.fn(async () => 'Carina status:\nUptime: 0h 0m');
  const toolsHandler = vi.fn(async () => 'Carina tools:\nActive: 71 tools');
  const stopHandler = vi.fn(async () => 'Current task cancelled.');

  const cmds = new Map([
    ['help', { name: 'help', description: 'Show help', handler: helpHandler }],
    ['new', { name: 'new', description: 'Fresh conversation', handler: newHandler }],
    ['status', { name: 'status', description: 'Status', handler: statusHandler }],
    ['tools', { name: 'tools', description: 'List tools', handler: toolsHandler }],
    ['stop', { name: 'stop', description: 'Cancel task', handler: stopHandler }],
  ]);

  return {
    getCommand: (name: string) => cmds.get(name),
    listCommands: () => Array.from(cmds.values()),
    registerCommand: vi.fn(),
  };
});

import { interceptSlashCommand } from './interceptor.js';
import type { ChannelMessage } from '../channel-adapter.interface.js';

function makeMsg(text: string): ChannelMessage {
  return {
    id: '1',
    channel: 'telegram',
    externalUserId: '42',
    conversationId: '42',
    text,
    timestamp: new Date(),
    isDirect: true,
    isMention: false,
    isCommand: text.startsWith('/'),
  };
}

describe('interceptSlashCommand', () => {
  it('returns handled: false for a non-slash message', async () => {
    const result = await interceptSlashCommand(makeMsg('hello'));
    expect(result.handled).toBe(false);
  });

  it('returns handled: false for an empty message', async () => {
    const result = await interceptSlashCommand(makeMsg(''));
    expect(result.handled).toBe(false);
  });

  it('handles /help and returns the response', async () => {
    const result = await interceptSlashCommand(makeMsg('/help'));
    expect(result.handled).toBe(true);
    expect(result.response).toBe('/help response');
  });

  it('handles /new and returns confirmation', async () => {
    const result = await interceptSlashCommand(makeMsg('/new'));
    expect(result.handled).toBe(true);
    expect(result.response).toContain('Fresh conversation');
  });

  it('handles /status and returns status output', async () => {
    const result = await interceptSlashCommand(makeMsg('/status'));
    expect(result.handled).toBe(true);
    expect(result.response).toContain('Carina status');
  });

  it('handles /tools and returns tools output', async () => {
    const result = await interceptSlashCommand(makeMsg('/tools'));
    expect(result.handled).toBe(true);
    expect(result.response).toContain('Carina tools');
  });

  it('handles /stop and returns cancellation message', async () => {
    const result = await interceptSlashCommand(makeMsg('/stop'));
    expect(result.handled).toBe(true);
    expect(result.response).toContain('cancelled');
  });

  it('handles unknown slash command with an informative message', async () => {
    const result = await interceptSlashCommand(makeMsg('/unknownxyz'));
    expect(result.handled).toBe(true);
    expect(result.response).toContain('Unknown command');
    expect(result.response).toContain('/unknownxyz');
    expect(result.response).toContain('/help');
  });

  it('strips whitespace from message text before matching', async () => {
    const result = await interceptSlashCommand(makeMsg('  /help  '));
    expect(result.handled).toBe(true);
    expect(result.response).toBe('/help response');
  });

  it('matches command names case-insensitively', async () => {
    const result = await interceptSlashCommand(makeMsg('/HELP'));
    expect(result.handled).toBe(true);
    expect(result.response).toBe('/help response');
  });
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, vi } from 'vitest';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('channel latency guard', () => {
  it('does not import channel stores into the agent turn path', () => {
    const files = [
      path.join(srcRoot, 'agents', 'carina.ts'),
      path.join(srcRoot, 'agents', 'orchestrator.ts'),
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source.includes('thread-ownership')).toBe(false);
      expect(source.includes('dm-pairing')).toBe(false);
      expect(source.includes('getChannelStatusReports')).toBe(false);
    }
  });

  it('guards return immediately when policy flags are off', async () => {
    delete process.env.CARINA_THREAD_OWNERSHIP;
    delete process.env.CARINA_CHANNEL_DM_PAIRING;
    const readSpy = vi.spyOn(fs, 'readFileSync');
    const { guardInboundMessage } = await import('./inbound-guards.js');
    const result = guardInboundMessage({
      id: '1',
      channel: 'discord',
      externalUserId: 'u1',
      conversationId: 'c1',
      text: 'hi',
      timestamp: new Date(),
      isDirect: true,
      isMention: true,
      isCommand: false,
    }, 'agent-a');
    expect(result.allow).toBe(true);
    expect(readSpy).not.toHaveBeenCalled();
    readSpy.mockRestore();
  });
});

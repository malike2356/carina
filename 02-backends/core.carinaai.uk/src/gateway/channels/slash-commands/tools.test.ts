import { describe, expect, it } from 'vitest';
import { toolsCommand } from './tools.js';

describe('toolsCommand', () => {
  it('reports active Telegram tools and the canonical full catalogue count', async () => {
    const output = await toolsCommand.handler({
      id: '1',
      channel: 'telegram',
      externalUserId: '42',
      conversationId: '42',
      text: '/tools',
      timestamp: new Date(),
      isDirect: true,
      isMention: false,
      isCommand: true,
    });

    expect(output).toContain('Carina tools:');
    expect(output).toMatch(/Active: \d+ tools/);
    expect(output).toContain('Active toolsets:');
    expect(output).toContain('Full catalogue: 233 tools across 21 capability layers');
    expect(output).toContain('Catalogue: https://docs.carinaai.uk/tools');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { statusCommand } from './status.js';

const originalDeployTimestamp = process.env.DEPLOY_TIMESTAMP;
const originalLabyrinthEnabled = process.env.LABYRINTH_ENABLED;
const originalScoutEnabled = process.env.SCOUT_ENABLED;

afterEach(() => {
  if (originalDeployTimestamp === undefined) delete process.env.DEPLOY_TIMESTAMP;
  else process.env.DEPLOY_TIMESTAMP = originalDeployTimestamp;

  if (originalLabyrinthEnabled === undefined) delete process.env.LABYRINTH_ENABLED;
  else process.env.LABYRINTH_ENABLED = originalLabyrinthEnabled;

  if (originalScoutEnabled === undefined) delete process.env.SCOUT_ENABLED;
  else process.env.SCOUT_ENABLED = originalScoutEnabled;
});

describe('statusCommand', () => {
  it('returns a compact Telegram status snapshot with runtime sections', async () => {
    process.env.DEPLOY_TIMESTAMP = '2026-06-27T17:00:00Z';
    process.env.LABYRINTH_ENABLED = 'false';
    delete process.env.SCOUT_ENABLED;

    const output = await statusCommand.handler({
      id: '1',
      channel: 'telegram',
      externalUserId: '42',
      conversationId: '42',
      text: '/status',
      timestamp: new Date(),
      isDirect: true,
      isMention: false,
      isCommand: true,
    });

    expect(output).toContain('Carina status:');
    expect(output).toContain('Uptime:');
    expect(output).toContain('Active toolsets:');
    expect(output).toContain('Active tools:');
    expect(output).toContain('Gateway: healthy');
    expect(output).toContain('Scout: not configured');
    expect(output).toContain('Embedding:');
    expect(output).toContain('Last deploy: 2026-06-27T17:00:00Z');
    expect(output).toContain('Durable memory:');
    expect(output).not.toContain('AIVA_EXTERNAL_MEMORY');
    expect(output.split('\n').length).toBeGreaterThanOrEqual(8);
  });
});

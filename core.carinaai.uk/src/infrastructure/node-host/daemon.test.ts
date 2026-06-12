import { describe, expect, it } from 'vitest';
import { executeCommand } from './daemon.js';

describe('node-host daemon commands', () => {
  it('handles ping', async () => {
    const result = await executeCommand({
      id: '1',
      nodeId: 'n',
      type: 'ping',
      payload: {},
      createdAt: new Date().toISOString(),
    });
    expect(result.result).toMatchObject({ pong: true });
  });

  it('blocks file.push outside allowed roots', async () => {
    process.env.CARINA_HOME = '/tmp/carina-daemon-test';
    const result = await executeCommand({
      id: '2',
      nodeId: 'n',
      type: 'file.push',
      payload: { path: '/etc/passwd', contentBase64: Buffer.from('x').toString('base64') },
      createdAt: new Date().toISOString(),
    });
    expect(result.error).toMatch(/outside allowed roots|Path traversal/);
  });

  it('blocks dangerous shell commands', async () => {
    const result = await executeCommand({
      id: '3',
      nodeId: 'n',
      type: 'shell',
      payload: { command: 'rm -rf /' },
      createdAt: new Date().toISOString(),
    });
    expect(result.error).toBeTruthy();
  });
});

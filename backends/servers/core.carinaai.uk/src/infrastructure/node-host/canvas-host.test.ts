import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasHost, resetCanvasHostForTests } from './canvas-host.js';
import { NodeCapability } from './node-protocol.js';

const sendCommand = vi.fn();

vi.mock('./node-host-server.js', () => ({
  getNodeHostServer: () => ({ sendCommand }),
}));

afterEach(() => {
  resetCanvasHostForTests();
  sendCommand.mockReset();
});

describe('CanvasHost', () => {
  it('stores artifacts and pushes render commands', async () => {
    sendCommand.mockResolvedValue({ type: 'response', id: '1', ok: true });
    const host = new CanvasHost();
    const artifact = host.createArtifact({
      type: 'html',
      content: '<h1>Hello</h1>',
      sessionId: 'sess-1',
      title: 'Demo',
    });

    const result = await host.pushToNode('node-1', artifact);
    expect(result.rendered).toBe(true);
    expect(sendCommand).toHaveBeenCalledWith(
      'node-1',
      NodeCapability.CANVAS_RENDER,
      'render',
      expect.objectContaining({ artifactId: artifact.id, type: 'html' }),
      15_000,
    );
    expect(host.getArtifact(artifact.id)?.content).toContain('Hello');
  });
});

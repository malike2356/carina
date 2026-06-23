import { describe, expect, it } from 'vitest';
import { NodeCapability, normalizeCapabilities } from './node-protocol.js';

describe('node-protocol', () => {
  it('normalizes capability strings', () => {
    expect(normalizeCapabilities(['canvas.render', 'camera.capture', 'invalid']))
      .toEqual([NodeCapability.CANVAS_RENDER, NodeCapability.CAMERA_CAPTURE]);
  });
});

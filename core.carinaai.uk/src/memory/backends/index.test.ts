import { describe, expect, it } from 'vitest';
import { initMemoryBackend, listMemoryBackends, setMemoryBackend } from './index.js';

describe('memory backends', () => {
  it('lists pluggable backends', () => {
    expect(listMemoryBackends()).toEqual(expect.arrayContaining(['postgres', 'sqlite', 'honcho', 'mem0']));
  });

  it('switches to sqlite backend', () => {
    const backend = setMemoryBackend('sqlite');
    expect(backend.name).toBe('sqlite');
    initMemoryBackend();
  });
});

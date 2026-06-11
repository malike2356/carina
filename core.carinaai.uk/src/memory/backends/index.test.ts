import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  describeMemoryBackends,
  initMemoryBackend,
  listMemoryBackends,
  setMemoryBackend,
} from './index.js';

describe('memory backends', () => {
  afterEach(() => {
    delete process.env.CARINA_MEMORY_BACKEND;
    initMemoryBackend();
  });

  it('lists pluggable backends including builtin', () => {
    expect(listMemoryBackends()).toEqual(
      expect.arrayContaining(['builtin', 'postgres', 'sqlite', 'honcho', 'mem0']),
    );
  });

  it('defaults to builtin backend', () => {
    const backend = initMemoryBackend();
    expect(backend.name).toBe('builtin');
  });

  it('switches to sqlite backend', () => {
    const backend = setMemoryBackend('sqlite');
    expect(backend.name).toBe('sqlite');
    expect(process.env.CARINA_MEMORY_BACKEND).toBe('sqlite');
  });

  it('accepts built-in alias', () => {
    const backend = setMemoryBackend('built-in');
    expect(backend.name).toBe('builtin');
  });

  it('describes backend metadata', () => {
    const rows = describeMemoryBackends();
    const builtin = rows.find((r) => r.name === 'builtin');
    const mem0 = rows.find((r) => r.name === 'mem0');
    expect(builtin?.displayName).toBe('Built-in');
    expect(mem0?.displayName).toBe('Mem0');
  });
});

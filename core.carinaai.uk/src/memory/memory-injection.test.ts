import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  memoryInjectionEnabled,
  memoryInjectionIncludesSemantic,
  memoryInjectionMode,
} from './memory-injection.js';

describe('memory injection modes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to full injection', () => {
    expect(memoryInjectionMode()).toBe('full');
    expect(memoryInjectionEnabled()).toBe(true);
    expect(memoryInjectionIncludesSemantic()).toBe(true);
  });

  it('supports minimal mode without semantic search', () => {
    vi.stubEnv('CARINA_MEMORY_INJECTION', 'minimal');
    expect(memoryInjectionMode()).toBe('minimal');
    expect(memoryInjectionEnabled()).toBe(true);
    expect(memoryInjectionIncludesSemantic()).toBe(false);
  });

  it('supports off mode', () => {
    vi.stubEnv('CARINA_MEMORY_INJECTION', 'off');
    expect(memoryInjectionEnabled()).toBe(false);
    expect(memoryInjectionIncludesSemantic()).toBe(false);
  });
});

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

  it('defaults to minimal injection without auto semantic recall', () => {
    expect(memoryInjectionMode()).toBe('minimal');
    expect(memoryInjectionEnabled()).toBe(true);
    expect(memoryInjectionIncludesSemantic()).toBe(false);
    expect(memoryInjectionIncludesSemantic('fix the bug')).toBe(false);
  });

  it('supports minimal mode without semantic search', () => {
    vi.stubEnv('CARINA_MEMORY_INJECTION', 'minimal');
    expect(memoryInjectionMode()).toBe('minimal');
    expect(memoryInjectionEnabled()).toBe(true);
    expect(memoryInjectionIncludesSemantic('last time we worked on auth')).toBe(false);
  });

  it('full mode injects semantic recall only on recall triggers', () => {
    vi.stubEnv('CARINA_MEMORY_INJECTION', 'full');
    expect(memoryInjectionIncludesSemantic('deploy the API')).toBe(false);
    expect(memoryInjectionIncludesSemantic('what did we decide last time?')).toBe(true);
  });

  it('full mode with CARINA_MEMORY_AUTO_SEMANTIC always injects semantic layers', () => {
    vi.stubEnv('CARINA_MEMORY_INJECTION', 'full');
    vi.stubEnv('CARINA_MEMORY_AUTO_SEMANTIC', 'true');
    expect(memoryInjectionIncludesSemantic('deploy the API')).toBe(true);
  });

  it('supports off mode', () => {
    vi.stubEnv('CARINA_MEMORY_INJECTION', 'off');
    expect(memoryInjectionEnabled()).toBe(false);
    expect(memoryInjectionIncludesSemantic('last time')).toBe(false);
  });
});

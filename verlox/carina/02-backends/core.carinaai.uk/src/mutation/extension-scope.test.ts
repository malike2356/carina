import { describe, expect, it } from 'vitest';
import {
  EXTENSION_ALLOWED_ROOT,
  validateAllPaths,
  validateExtensionPath,
} from './extension-scope.js';

describe('validateExtensionPath', () => {
  it('accepts files inside EXTENSION_ALLOWED_ROOT', () => {
    const result = validateExtensionPath(`${EXTENSION_ALLOWED_ROOT}my_tool.ts`);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects files outside EXTENSION_ALLOWED_ROOT', () => {
    const result = validateExtensionPath('src/brain/llm.ts');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('outside the allowed root');
  });

  it('rejects path traversal outside allowed root', () => {
    const result = validateExtensionPath(`${EXTENSION_ALLOWED_ROOT}../../brain/llm.ts`);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('outside the allowed root');
  });
});

describe('validateAllPaths', () => {
  it('returns valid=true when all paths pass', () => {
    const result = validateAllPaths([
      `${EXTENSION_ALLOWED_ROOT}tool_a.ts`,
      `${EXTENSION_ALLOWED_ROOT}tool_b.ts`,
    ]);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('returns valid=false with violations when any path fails', () => {
    const result = validateAllPaths([
      `${EXTENSION_ALLOWED_ROOT}tool_a.ts`,
      'src/server.ts',
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

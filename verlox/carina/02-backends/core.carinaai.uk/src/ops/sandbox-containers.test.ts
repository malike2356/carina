import { describe, expect, it } from 'vitest';
import { explainSandbox } from './sandbox-containers.js';

describe('sandbox-containers', () => {
  it('explainSandbox returns container contract without docker', () => {
    const info = explainSandbox('agent-test');
    expect(info.name).toContain('agent-test');
    expect(info.network).toBe('none');
    expect(info.readOnly).toBe(true);
    expect(info.memoryMb).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { resolveSessionToolNames } from './session-tool-resolution.js';
import { LEAF_EXCLUDED_TOOLS } from './toolset.js';

describe('session-tool-resolution', () => {
  it('subagent sessions do not receive always-on orchestration tools', () => {
    const names = resolveSessionToolNames({
      sessionId: 'parent:sub:abc',
      explicitAllowed: ['terminal', 'file', 'web'],
    });
    for (const blocked of LEAF_EXCLUDED_TOOLS) {
      expect(names).not.toContain(blocked);
    }
    expect(names).toContain('file-read');
    expect(names).toContain('shell-exec');
  });

  it('main sessions include always-on tools', () => {
    const names = resolveSessionToolNames({
      sessionId: 'cli-main',
      platform: 'default',
    });
    expect(names).toContain('memory');
    expect(names).toContain('todo');
  });
});

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { resolveSessionToolNames, resolveSessionTools } from './session-tool-resolution.js';
import { LEAF_EXCLUDED_TOOLS } from './toolset.js';
import { registerSessionTool, clearSessionTools, listSessionTools } from './session-tool-store.js';
import type { Tool } from '../types/index.js';
import { setWorkerSessionContext, clearWorkerSessionContext } from '../workers/worker-session-context.js';

const SESSION = 'aiva-test-worker-web-app';

function stubTool(name: string): Tool {
  return {
    name,
    description: `${name} stub`,
    parameters: { type: 'object', properties: {} },
    execute: async () => ({ ok: true }),
  };
}

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

describe('session-tool-resolution product/propreneur adapters', () => {
  beforeEach(() => {
    clearSessionTools(SESSION);
    clearWorkerSessionContext(SESSION);
    setWorkerSessionContext(SESSION, {
      worker: {
        id: 'worker-1',
        workspaceId: 'ws-1',
        name: 'Selorm',
        status: 'active',
        personaPrompt: 'You are Selorm.',
        skillPacks: [],
        roleDescription: 'support',
      } as import('../types/index.js').Worker,
      personaPrompt: 'You are Selorm.',
    });
  });

  afterEach(() => {
    clearSessionTools(SESSION);
    clearWorkerSessionContext(SESSION);
  });

  it('includes session-registered tools even when they are not in the global toolset', async () => {
    registerSessionTool(SESSION, stubTool('propreneur-connect'));
    registerSessionTool(SESSION, stubTool('gmail-list'));
    registerSessionTool(SESSION, stubTool('google-drive-search'));

    const resolution = await resolveSessionTools({
      sessionId: SESSION,
      platform: 'default',
    });

    expect(listSessionTools(SESSION).map((t) => t.name)).toEqual(
      expect.arrayContaining(['propreneur-connect', 'gmail-list', 'google-drive-search']),
    );
    expect(resolution.names).toContain('propreneur-connect');
    expect(resolution.names).toContain('gmail-list');
    expect(resolution.names).toContain('google-drive-search');
    expect(resolution.tools.some((t) => t.name === 'gmail-list')).toBe(true);
  });
});

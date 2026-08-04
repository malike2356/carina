import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  isAivaWorkspaceSession,
  resolveSessionToolNames,
  resolveSessionTools,
} from './session-tool-resolution.js';
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
    expect(names).toContain('tool_status');
  });

  it('identifies Aiva worker sessions', () => {
    expect(isAivaWorkspaceSession('aiva-worker-1-telegram-owner')).toBe(true);
    expect(isAivaWorkspaceSession('cli-main')).toBe(false);
  });

  it('gives Aiva Telegram sessions the full workspace catalog except blocked security tools', () => {
    const names = resolveSessionToolNames({
      sessionId: 'aiva-worker-1-telegram-owner',
      platform: 'telegram',
    });

    expect(names).toContain('documents-manage');
    expect(names).toContain('kanban-create');
    expect(names).toContain('blog-create');
    expect(names).toContain('tool_status');
    expect(names).not.toContain('shell-exec');
    expect(names).not.toContain('nmap');
    // Host memory/search would browse other tenants on shared Core.
    expect(names).not.toContain('session-search');
    expect(names).not.toContain('memory');
    expect(names).not.toContain('agent-sync');
    expect(names).not.toContain('github-agent-sync');
  });

  it('keeps ordinary Telegram sessions on the Telegram preset', () => {
    const names = resolveSessionToolNames({
      sessionId: 'telegram-owner',
      platform: 'telegram',
    });

    expect(names).toContain('send-message');
    expect(names).not.toContain('documents-manage');
    expect(names).not.toContain('kanban-create');
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

  it('keeps only allowlisted session tools when explicitAllowed is set', async () => {
    registerSessionTool(SESSION, stubTool('gmail-send'));
    registerSessionTool(SESSION, stubTool('gmail-list'));
    registerSessionTool(SESSION, stubTool('propreneur-connect'));

    const resolution = await resolveSessionTools({
      sessionId: SESSION,
      platform: 'default',
      explicitAllowed: ['gmail-send', 'email-send', 'http-request'],
    });

    expect(resolution.names).toContain('gmail-send');
    expect(resolution.names).not.toContain('propreneur-connect');
    expect(resolution.names).not.toContain('gmail-list');
  });
});

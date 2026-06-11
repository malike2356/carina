import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registry } from '../../tools/registry.js';
import '../../tools/index.js';
import {
  createMcpServerState,
  handleMcpRequest,
} from './handlers.js';
import {
  isToolExposedOnMcp,
  listMcpTools,
  resolveMcpToolNames,
} from './tool-catalog.js';
import { bindMcpProfile } from './profile-bind.js';
import { parseMcpServerOptions } from './config.js';
import {
  resolveActiveToolNames,
  saveToolsetsConfig,
} from '../../tools/toolset-config.js';

describe('mcp server tool catalog', () => {
  it('advertises registered tools from the dynamic registry', () => {
    const names = resolveMcpToolNames(false);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(registry.get(name)).toBeDefined();
    }
  });

  it('filters dangerous and credential-gated tools by default', () => {
    const safe = new Set(resolveMcpToolNames(false));
    expect(safe.has('shell-exec')).toBe(false);
    expect(safe.has('file-write')).toBe(false);
    expect(safe.has('mcp')).toBe(false);
    expect(safe.has('web-search')).toBe(true);
  });

  it('includes dangerous tools only when allowDangerous is true', () => {
    const dangerous = resolveMcpToolNames(true);
    const safe = resolveMcpToolNames(false);
    expect(dangerous.length).toBeGreaterThan(safe.length);
    expect(dangerous).toContain('file-write');
  });

  it('respects isToolExposedOnMcp for risk registry', () => {
    const shell = registry.get('shell-exec');
    expect(shell).toBeDefined();
    expect(isToolExposedOnMcp(shell!, false)).toBe(false);
    expect(isToolExposedOnMcp(shell!, true)).toBe(true);
  });
});

describe('mcp server handlers', () => {
  const profile = {
    profileName: 'test-profile',
    profile: null,
    toolsetsPath: '/tmp/toolsets.yaml',
  };

  it('handles initialize and tools/list', async () => {
    const state = createMcpServerState(
      {
        transport: 'stdio',
        allowDangerous: false,
        httpPort: 8765,
        httpHost: '127.0.0.1',
        sessionId: 'mcp-test',
      },
      profile,
    );

    const init = await handleMcpRequest(state, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      },
    });
    expect(init?.result).toMatchObject({
      serverInfo: { name: 'carina-mcp-server', profile: 'test-profile' },
    });

    const listed = await handleMcpRequest(state, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    const tools = (listed?.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name === 'shell-exec')).toBe(false);
  });

  it('rejects tools/call for non-exposed dangerous tools', async () => {
    const state = createMcpServerState(
      {
        transport: 'stdio',
        allowDangerous: false,
        httpPort: 8765,
        httpHost: '127.0.0.1',
        sessionId: 'mcp-test',
      },
      profile,
    );
    state.initialized = true;

    const response = await handleMcpRequest(state, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'shell-exec', arguments: { command: 'echo hi' } },
    });
    expect(response?.error?.message).toContain('not exposed');
  });

  it('executes a safe tool via tools/call', async () => {
    const state = createMcpServerState(
      {
        transport: 'stdio',
        allowDangerous: false,
        httpPort: 8765,
        httpHost: '127.0.0.1',
        sessionId: 'mcp-test',
      },
      profile,
    );
    state.initialized = true;

    const response = await handleMcpRequest(state, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'skills-list',
        arguments: {},
      },
    });
    const result = response?.result as { content: Array<{ text: string }>; isError: boolean };
    expect(result.isError).toBe(false);
    expect(result.content[0]?.text).toBeTruthy();
  });
});

describe('mcp profile binding', () => {
  let tmpRoot = '';
  let prevProfilesDir: string | undefined;
  let prevToolsetsFile: string | undefined;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-mcp-profile-'));
    prevProfilesDir = process.env.CARINA_PROFILES_DIR;
    prevToolsetsFile = process.env.CARINA_TOOLSETS_FILE;
    process.env.CARINA_PROFILES_DIR = path.join(tmpRoot, 'profiles');
    fs.mkdirSync(process.env.CARINA_PROFILES_DIR, { recursive: true });
  });

  afterEach(() => {
    if (prevProfilesDir === undefined) delete process.env.CARINA_PROFILES_DIR;
    else process.env.CARINA_PROFILES_DIR = prevProfilesDir;
    if (prevToolsetsFile === undefined) delete process.env.CARINA_TOOLSETS_FILE;
    else process.env.CARINA_TOOLSETS_FILE = prevToolsetsFile;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('scopes toolsets to the active profile directory', async () => {
    const profileDir = path.join(process.env.CARINA_PROFILES_DIR!, 'alpha');
    fs.mkdirSync(path.join(profileDir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(profileDir, 'config.yaml'), 'provider: deepseek\n');
    fs.writeFileSync(path.join(profileDir, '.env'), '# profile env\n');

    const toolsetsPath = path.join(profileDir, 'toolsets.yaml');
    await saveToolsetsConfig(
      { version: 1, platforms: { mcp: { enabled: ['search'] } } },
      toolsetsPath,
    );

    const ctx = bindMcpProfile('alpha');
    expect(ctx.profileName).toBe('alpha');
    expect(ctx.toolsetsPath).toBe(toolsetsPath);

    const names = resolveActiveToolNames({ platform: 'mcp' });
    expect(names).toContain('web-search');
    expect(names).not.toContain('shell-exec');
  });
});

describe('mcp server config', () => {
  it('parses CLI flags', () => {
    const opts = parseMcpServerOptions(['--http', '--profile', 'work', '--allow-dangerous', '--port', '9000']);
    expect(opts.transport).toBe('http');
    expect(opts.profileName).toBe('work');
    expect(opts.allowDangerous).toBe(true);
    expect(opts.httpPort).toBe(9000);
    expect(opts.sessionId).toBe('mcp-work');
  });
});

describe('mcp server isolation from agent loop', () => {
  it('agent runtime does not import mcp server modules', async () => {
    const { readFileSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
    const agentFiles = [
      path.join(root, 'agents', 'carina.ts'),
      path.join(root, 'agents', 'tool-runner.ts'),
      path.join(root, 'gateway', 'router.ts'),
    ];
    for (const file of agentFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source.includes('mcp/server')).toBe(false);
    }
  });

  it('tools/index does not import mcp server modules', async () => {
    const { readFileSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
    const source = readFileSync(path.join(root, 'tools', 'index.ts'), 'utf8');
    expect(source.includes('mcp/server')).toBe(false);
  });
});

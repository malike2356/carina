import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { issueWsToken, peekWsToken, clearWsTokens } from './ws-tokens.js';
import { isWsAuthorized, resolveCarinaSpawnCommand } from './pty-bridge-core.js';
import type { IncomingMessage } from 'node:http';

function mockRequest(url: string, headers: Record<string, string> = {}): IncomingMessage {
  return { url, headers } as IncomingMessage;
}

describe('ws-tokens', () => {
  beforeEach(() => clearWsTokens());
  afterEach(() => clearWsTokens());

  it('issues tokens that pass peek validation', () => {
    const token = issueWsToken();
    expect(peekWsToken(token)).toBe(true);
  });
});

describe('pty-bridge auth', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    clearWsTokens();
    process.env.NODE_ENV = 'test';
    delete process.env.ADMIN_WS_TOKEN;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    clearWsTokens();
  });

  it('rejects requests without token outside development', () => {
    process.env.NODE_ENV = 'production';
    expect(isWsAuthorized(mockRequest('/ws/tui'))).toBe(false);
  });

  it('accepts page-issued ws token', () => {
    process.env.NODE_ENV = 'production';
    const token = issueWsToken();
    expect(isWsAuthorized(mockRequest(`/ws/tui?token=${token}`))).toBe(true);
  });

  it('accepts bearer ADMIN_WS_TOKEN', () => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_WS_TOKEN = 'secret-bridge-token';
    expect(isWsAuthorized(mockRequest('/ws/tui', {
      authorization: 'Bearer secret-bridge-token',
    }))).toBe(true);
  });
});

describe('resolveCarinaSpawnCommand', () => {
  const originalDocker = process.env.CARINA_OPS_IN_DOCKER;
  const originalService = process.env.CARINA_PTY_DOCKER_SERVICE;

  afterEach(() => {
    if (originalDocker === undefined) delete process.env.CARINA_OPS_IN_DOCKER;
    else process.env.CARINA_OPS_IN_DOCKER = originalDocker;
    if (originalService === undefined) delete process.env.CARINA_PTY_DOCKER_SERVICE;
    else process.env.CARINA_PTY_DOCKER_SERVICE = originalService;
    delete process.env.CARINA_PTY_DOCKER_CONTAINER;
    delete process.env.CARINA_PTY_DOCKER_DISABLED;
  });

  it('resolves carina tui command from core workspace', () => {
    delete process.env.CARINA_OPS_IN_DOCKER;
    const cmd = resolveCarinaSpawnCommand();
    expect(cmd.file).toBeTruthy();
    expect(cmd.args.join(' ')).toContain('tui');
    expect(cmd.cwd).toContain('core.carinaai.uk');
  });

  it('prefers docker exec into carina-web when ops runs in docker', () => {
    process.env.CARINA_OPS_IN_DOCKER = 'true';
    process.env.CARINA_PTY_DOCKER_CONTAINER = 'carina-web-test';
    const cmd = resolveCarinaSpawnCommand();
    expect(cmd.file).toBe('docker');
    expect(cmd.args).toContain('carina-web-test');
    expect(cmd.args.join(' ')).toContain('tui --simple');
  });
});

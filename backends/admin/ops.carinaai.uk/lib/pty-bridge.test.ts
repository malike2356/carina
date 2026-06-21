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
  it('resolves carina tui command from core workspace', () => {
    const cmd = resolveCarinaSpawnCommand();
    expect(cmd.file).toBeTruthy();
    expect(cmd.args.join(' ')).toContain('tui');
    expect(cmd.cwd).toContain('core.carinaai.uk');
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('browser session - Playwright unavailable', () => {
  function mockPlaywrightMissing(): void {
    vi.doMock('playwright', () => {
      throw new Error('Cannot find module playwright');
    });
  }

  it('browserNavigate returns error object when Playwright is not installed', async () => {
    mockPlaywrightMissing();
    const { browserNavigate } = await import('./session.js');
    const result = await browserNavigate('test-session', 'https://example.com') as { error?: string };
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/playwright/i);
  });

  it('browserClick returns error object when Playwright is not installed', async () => {
    mockPlaywrightMissing();
    const { browserClick } = await import('./session.js');
    const result = await browserClick('test-session', '@e1') as { error?: string };
    expect(result.error).toBeDefined();
  });

  it('browserSnapshot returns error object when Playwright is not installed', async () => {
    mockPlaywrightMissing();
    const { browserSnapshot } = await import('./session.js');
    const result = await browserSnapshot('test-session') as { error?: string };
    expect(result.error).toBeDefined();
  });
});

describe('browser session - nav guard integration', () => {
  it('browserNavigate returns error for localhost URLs', async () => {
    vi.doMock('playwright', () => ({
      chromium: { launch: vi.fn().mockResolvedValue({
        newContext: vi.fn().mockResolvedValue({
          addInitScript: vi.fn(),
          newPage: vi.fn(),
        }),
      }),
    }}));
    const { browserNavigate } = await import('./session.js');
    const result = await browserNavigate('test-session', 'http://localhost/admin') as { error?: string };
    expect(result.error).toContain('blocked');
  });

  it('browserNavigate returns error for file:// URLs', async () => {
    const { browserNavigate } = await import('./session.js');
    const result = await browserNavigate('test-session', 'file:///etc/passwd') as { error?: string };
    expect(result.error).toContain('protocol');
  });
});

describe('browser session - unknown ref', () => {
  it('browserClick returns error for unknown ref when session has no snapshot', async () => {
    const mockPage = {
      on: vi.fn(),
      goto: vi.fn().mockResolvedValue(null),
      url: vi.fn().mockReturnValue('https://example.com'),
      evaluate: vi.fn().mockResolvedValue([]),
      innerText: vi.fn().mockResolvedValue('hello'),
      locator: vi.fn().mockReturnValue({ click: vi.fn() }),
      keyboard: { press: vi.fn() },
      mouse: { wheel: vi.fn() },
      screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
      context: vi.fn().mockReturnValue({
        newCDPSession: vi.fn(),
      }),
    };
    const mockContext = {
      addInitScript: vi.fn(),
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
    };
    vi.doMock('playwright', () => ({
      chromium: { launch: vi.fn().mockResolvedValue(mockBrowser) },
    }));

    const { browserNavigate, browserClick, checkPlaywright } = await import('./session.js');
    await checkPlaywright();
    await browserNavigate('ref-test', 'https://example.com');
    await browserNavigate('other-session', 'https://example.com');
    expect(mockBrowser.newContext).toHaveBeenCalledTimes(2);
    const result = await browserClick('ref-test', '@e999') as { error?: string };
    expect(result.error).toContain('@e999');
  });
});

describe('checkPlaywright', () => {
  it('returns false when playwright module is missing', async () => {
    vi.doMock('playwright', () => { throw new Error('not found'); });
    const { checkPlaywright } = await import('./session.js');
    const available = await checkPlaywright();
    expect(available).toBe(false);
  });
});

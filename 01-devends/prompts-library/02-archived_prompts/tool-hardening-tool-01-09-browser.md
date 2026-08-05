# Cursor Task: Fix and test browser tools (#1-9) in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are hardening the 27 Hermes tools one by one. This task covers the 12 browser
tools (Hermes tools #1-9 map to Carina's browser-navigate, browser-click,
browser-type, browser-press, browser-scroll, browser-snapshot, browser-console,
browser-back, browser-get-images, browser-vision, browser-cdp, browser-dialog).

Read these files in full before touching anything:
- `src/tools/browser/session.ts` (main file to fix)
- `src/tools/browser/tools.ts` (remove dead code + description)
- `src/tools/browser/nav-guard.ts` (read only)
- `src/tools/browser/snapshot.ts` (read only)
- `src/tools/browser/nav-guard.test.ts` (read only - do not change)
- `src/tools/browser/snapshot.test.ts` (read only - do not change)

Do NOT modify `nav-guard.ts`, `snapshot.ts`, `nav-guard.test.ts`, or
`snapshot.test.ts`.

Create one new file: `src/tools/browser/session.test.ts`.

---

## Bug: browser functions throw instead of returning { error }

Every exported function in `session.ts` calls `getOrCreateSession(sessionId)` which
throws `new Error('Playwright is not installed...')` when Playwright is unavailable.
Because there is no try/catch, the throw propagates out of `execute` as an unhandled
rejection instead of returning a clean `{ error: string }`.

The same applies to all other runtime errors: page navigation failures, selector
mismatches, CDP errors, and screenshot failures all throw rather than returning
`{ error }`.

### Fix: wrap the body of every exported function in `session.ts` with try/catch

Apply this pattern to all 12 exported functions
(`browserNavigate`, `browserClick`, `browserType`, `browserPress`, `browserScroll`,
`browserSnapshot`, `browserConsole`, `browserBack`, `browserGetImages`,
`browserVision`, `browserCdp`, `browserDialog`):

```typescript
export async function browserNavigate(sessionId: string, url: string): Promise<object> {
  try {
    await assertNavigationAllowed(url);
    const session = await getOrCreateSession(sessionId);
    await withTimeout(() => session.page.goto(url, { waitUntil: 'domcontentloaded' }));
    const snap = await refreshSnapshot(session);
    return { url: session.page.url(), snapshot: snap.compact };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
```

Do the same for all other exported functions. The catch block is identical in every
case: `return { error: err instanceof Error ? err.message : String(err) }`.

`browserCdp` already has an inner try/catch for the CDP call itself - keep that, but
also wrap the whole function body with an outer try/catch for `getOrCreateSession`
failures.

---

## Dead code: remove `inject` from `tools.ts`

In `src/tools/browser/tools.ts`, the `inject` helper is defined but never called:

```typescript
const inject = (params: Record<string, unknown>) => ({ ...params, _sessionId: sid });
```

Remove this line. The `sid` binding at the top of `createBrowserTools` is also unused
since all tools use `sessionFromParams(params)` instead. Remove `sid` too if it is
not referenced anywhere else in the function.

Do not change anything else in `tools.ts` except the description fix below.

---

## Description fix in `tools.ts`

Update the `browser-navigate` description only:

```
'Navigate to a URL. Initializes a Playwright Chromium session (requires Playwright installed: pnpm add playwright && npx playwright install chromium). Returns a compact snapshot with interactive element ref IDs. Must be called before any other browser tool. For plain-text endpoints (.md, .txt, .json), prefer http-request or shell-exec instead.'
```

---

## Create `src/tools/browser/session.test.ts`

All tests must mock Playwright so no real browser is required. Use `vi.doMock` +
`vi.resetModules()` in `beforeEach`.

```typescript
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
    };
    const mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
    };
    vi.doMock('playwright', () => ({
      chromium: { launch: vi.fn().mockResolvedValue(mockBrowser) },
    }));

    const { browserNavigate, browserClick } = await import('./session.js');
    await browserNavigate('ref-test', 'https://example.com');
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
```

---

## What NOT to change

- Do not change `nav-guard.ts`, `snapshot.ts`, or their tests.
- Do not change the tool parameters for any browser tool.
- Do not change `getOrCreateSession`, `refreshSnapshot`, `withTimeout`, or
  `ensureCleanupTimer` internals.
- Do not add or remove any exported functions from `session.ts`.
- Do not change `clearBrowserSession` or `getBrowserPage`.
- Do not remove existing tests in `nav-guard.test.ts` or `snapshot.test.ts`.

---

## General rules

- TypeScript only. No `any` unless unavoidable.
- No em dashes, no emojis anywhere.
- Run `npx tsc --noEmit` after changes and fix all errors before moving on.
- Do not touch files not listed in this prompt.

---

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/browser/session.test.ts` - all 7 tests pass
- [ ] `npx vitest run src/tools/browser/nav-guard.test.ts src/tools/browser/snapshot.test.ts` - still pass (4 + 2 = 6)
- [ ] Every exported function in `session.ts` has an outer try/catch returning `{ error: string }`
- [ ] `inject` helper and unused `sid` binding removed from `tools.ts`
- [ ] `browser-navigate` description updated in `tools.ts`
- [ ] Regression: `npx vitest run src/tools/shell.test.ts src/tools/file.test.ts src/tools/patch.test.ts src/tools/search-files.test.ts src/tools/process.test.ts src/tools/delegate-task.test.ts src/tools/code.test.ts` - all pass

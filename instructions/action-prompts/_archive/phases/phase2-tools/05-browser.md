# Action: Browser Automation Tools (New Feature, Standalone Carina)

## Goal
Build the 9 browser automation tools (`browser-navigate`, `browser-click`, `browser-type`, `browser-press`, `browser-scroll`, `browser-snapshot`, `browser-console`, `browser-back`, `browser-get-images`) using Playwright, wired into Carina's existing security layer (egress filtering, SSRF protections, Scout audit logging).

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- This is a genuine, large gap: nothing browser-related exists (`grep -rln 'playwright\|puppeteer\|browser' src/ --include='*.ts'` returns nothing in `src/tools` or `src/agents`). Neither Playwright nor Puppeteer is in `package.json`.
- **This is also the highest-risk new tool surface in this batch**: an LLM-driven headless browser that can navigate anywhere, click anything, and execute arbitrary JavaScript in page context is a powerful SSRF/exfiltration vector if not bounded carefully. Carina already has the right building blocks for this - read them before writing anything:
  - `src/security/egress-filter.ts` (`EgressFilter`, `DEFAULT_ALLOWED_DOMAINS`, `SENSITIVE_PATTERNS`, `EgressBlockedError`, `DataLeakError`) - the spec's "block internal IPs" and "log all URLs to Scout" requirements are EXACTLY what this module exists to enforce. Browser navigation must go through it, not around it.
  - `src/tools/http.ts` + `src/tools/http.test.ts` - read the existing localhost/internal-IP blocking tests; your browser-navigate tests should cover the same IP ranges (`127.0.0.1`, `10.x`, `192.168.x`, `172.16-31.x`) using the same validation function if one already exists at the URL-parsing level, rather than writing a second blocklist that can drift out of sync
  - `src/security/honeypot-client.ts` - if Carina's honeypot system tracks URLs/domains the way it tracks file paths and API keys, browser navigation should check against it too
- Conventions: classes under ~200 lines, functions under ~20 lines, Vitest (mock Playwright - do not spin up real browsers in the unit suite), no em dashes/emojis, `.js` import specifiers.

## Files to create
- `src/tools/browser/session.ts` - `BrowserSessionManager` (one Playwright context per Carina session, lifecycle, cleanup)
- `src/tools/browser/snapshot.ts` - accessibility-tree snapshot generation with `@e1`/`@e2`-style ref ID assignment
- `src/tools/browser/tools.ts` - the 9 `Tool` definitions, thin wrappers over the session manager
- `src/tools/browser/tools.test.ts`
- `src/tools/browser/session.test.ts`

## Files to modify
- `src/tools/index.ts` - register the 9 tools, gated on Playwright being installed/available (probe pattern, mirror `checkDocker`)
- `package.json` - add `playwright` (recommended over Puppeteer: better accessibility-tree/snapshot APIs, which 3 of these 9 tools depend on)
- `.env.production.example` - document any new env vars (e.g. headless mode toggle, browser binary path)

## Step-by-step

1. **Design the SSRF/security gate FIRST, as a single chokepoint function**, before writing any tool:
   ```ts
   async function assertNavigationAllowed(url: string): Promise<void> {
     // 1. Reject file:// and other non-http(s) protocols
     // 2. Resolve hostname, reject loopback/private/link-local ranges
     // 3. Run through egressFilter / DEFAULT_ALLOWED_DOMAINS if Carina's egress
     //    policy is meant to apply to browser traffic too (confirm this with
     //    the existing egress-filter design - browsing the open web is a
     //    different trust model than outbound API calls, so the allowlist
     //    might legitimately need to be broader for browser-navigate; if so,
     //    document why browser egress uses different rules than http egress,
     //    do not silently maintain two unrelated allowlists)
     // 4. Log the URL via reportEvent/reportToolCall regardless of outcome
   }
   ```
   Every tool that can cause navigation (`browser-navigate`, `browser-back`, and indirectly `browser-click`/`browser-press` if they trigger link follows) must call this. A single chokepoint means a future fix only needs to happen once.

2. **Build `BrowserSessionManager`** (`session.ts`):
   - One Playwright `BrowserContext` per Carina session ID, created lazily on first `browser-navigate`, with isolated cookies/storage (`browser.newContext()` gives this for free - confirm and don't add redundant isolation code)
   - Inject stealth/anti-detection scripts via `context.addInitScript(...)` (the spec asks for this; keep the script list small and documented - this is for sites that block obvious headless browsers, not for evading any of Carina's own security)
   - A `Map<sessionId, { context, page, refMap }>` registry with a cleanup path (idle timeout - decide and document a value, e.g. 10 minutes of inactivity, mirroring the kind of session-GC pattern in `router.ts`'s `gcTimer`)
   - 30-second per-operation timeout (the spec's stated limit) wrapping every Playwright call

3. **Build the ref-ID snapshot system** (`snapshot.ts`) - this is the trickiest piece and is shared by `browser-navigate`, `browser-snapshot`, and indirectly by `browser-click`/`browser-type` (which resolve `@e5`-style refs back to live elements):
   - On each navigation/snapshot, walk the accessibility tree (Playwright's `page.accessibility.snapshot()` or a DOM-based interactive-element query - accessibility snapshots are the more robust choice and match the spec's "accessibility tree snapshot" wording)
   - Assign sequential `@e1`, `@e2`, ... IDs to interactive elements (links, buttons, inputs, etc.) for this page state, store a `Map<refId, ElementHandle>` (or a re-resolvable selector, since stale `ElementHandle`s after navigation are a classic Playwright footgun - prefer storing enough info to re-query the element at click-time over holding a handle that may have detached)
   - `full: true` returns complete page text content; `full: false` returns the compact interactive-element list. Truncate/summarise snapshots over 8000 characters per the spec - decide and document where the cut happens (truncate raw text vs. summarise via an LLM call; truncation is simpler, cheaper, and more predictable - prefer it unless there's a clear reason not to)
   - Reset the ref map on every navigation (refs from a previous page must not resolve to elements on a new one)

4. **Build the 9 tools** (`tools.ts`) as thin wrappers - each under ~20 lines of actual logic, delegating to the session manager and snapshot system:
   - `browser-navigate`: gate through `assertNavigationAllowed`, `page.goto(url)`, return a fresh compact snapshot. Add the spec's note as part of the tool description string (visible to the LLM): "For plain-text endpoints (.md, .txt, .json, .csv, .xml), prefer curl/terminal" - this steers the LLM away from spinning up a browser for things `http-tool`/`shell-exec` handle better and cheaper.
   - `browser-click`/`browser-type`/`browser-press`: resolve `ref` via the snapshot's ref map, perform the action, return a brief result + whether navigation occurred
   - `browser-scroll`: `page.mouse.wheel` or `page.evaluate(() => window.scrollBy(...))` in the given direction
   - `browser-snapshot`: re-run the snapshot system on demand
   - `browser-console`: maintain a per-page buffer of `console`/`pageerror` events (`page.on('console', ...)`, `page.on('pageerror', ...)`); `clear: true` empties it; `expression` runs `page.evaluate(expr)` and JSON-serialises the result (wrap in try/catch - page-context JS can throw, and the error needs to come back as data, not crash the tool)
   - `browser-back`: `page.goBack()`, gated through `assertNavigationAllowed` on the resulting URL (a redirect chain on "back" could still land somewhere blocked)
   - `browser-get-images`: `page.$$eval('img', els => els.map(el => ({ url: el.src, alt: el.alt })))`

5. Wire `reportToolCall`/`reportEvent` (Scout audit logging) into every tool - the spec explicitly requires "log all URLs visited." Confirm this composes with the `assertNavigationAllowed` logging from step 1 without double-logging the same event.

6. Probe for Playwright availability at startup (mirror `checkDocker`'s cached-probe pattern) and gate registration in `src/tools/index.ts` - if browsers can't launch (missing system deps, no display in a minimal container), the tools should not appear in the registry rather than failing on first use. Document the system dependencies Playwright needs (`npx playwright install --with-deps chromium` or equivalent) in `.env.production.example` or a setup doc.

7. Write `session.test.ts` and `tools.test.ts` (Vitest, mock `playwright` entirely - `vi.mock('playwright', ...)`):
   - Test `assertNavigationAllowed` against the same internal-IP test matrix `http.test.ts` uses, plus `file://` and other non-http(s) schemes
   - Test ref-ID assignment is sequential and resets on navigation
   - Test stale-ref resolution returns a clear error rather than throwing a raw Playwright "element not found" exception
   - Test `browser-console`'s `expression` evaluation catches and returns page-context errors as data
   - Test session cleanup removes idle contexts after the timeout (`vi.useFakeTimers()`)

## Expected behavior
- Carina can navigate to a public URL, see a compact interactive snapshot, click/type/submit a form, and read back results - all without ever reaching a blocked internal address.
- Every navigated URL appears in the Scout audit trail.
- `browser-console` lets the agent debug a page's JS state without screenshotting.
- Sessions clean up automatically; nothing accumulates across many conversations.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/browser/
pnpm test
pnpm build
```
Manual check (requires `npx playwright install chromium`):
```
In a Carina session: "Go to example.com, take a snapshot, and tell me what links are on the page"
```

## Dependencies
- `playwright` (new npm dependency - not currently present; budget for the browser-binary download step in CI/Docker image builds)
- System dependencies for headless Chromium (fonts, shared libraries - Playwright's installer documents these; the production Docker image will need updating, see `docker/Dockerfile.carina`)
- `src/security/egress-filter.ts` must already be working correctly (verified in `06-scout-integration.md`) since this tool's safety depends on it

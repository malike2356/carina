import type { Browser, BrowserContext, ConsoleMessage, Page } from 'playwright';
import { tempFile } from '../../lib/platform-paths.js';
import { assertNavigationAllowed } from './nav-guard.js';
import type { SnapshotResult } from './snapshot.js';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const OP_TIMEOUT_MS = 30_000;

interface ConsoleEntry {
  type: string;
  text: string;
}

interface BrowserSession {
  page: Page;
  context: BrowserContext;
  snapshot: SnapshotResult;
  consoleLog: ConsoleEntry[];
  lastActivity: number;
}

let playwrightModule: typeof import('playwright') | null = null;
let playwrightAvailable: boolean | null = null;

export async function checkPlaywright(): Promise<boolean> {
  if (playwrightAvailable !== null) return playwrightAvailable;
  try {
    playwrightModule = await import('playwright');
    playwrightAvailable = true;
  } catch {
    playwrightAvailable = false;
  }
  return playwrightAvailable;
}

const sessions = new Map<string, BrowserSession>();
let sharedBrowser: Browser | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

async function destroyBrowserSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  await session.context.close().catch(() => undefined);
}

function ensureCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > IDLE_TIMEOUT_MS) {
        void destroyBrowserSession(id);
      }
    }
  }, 60_000);
  cleanupTimer.unref();
}

async function getOrCreateSession(sessionId: string): Promise<BrowserSession> {
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.lastActivity = Date.now();
    return existing;
  }

  if (!playwrightModule) {
    throw new Error('Playwright is not installed. Run: pnpm add playwright && npx playwright install chromium');
  }

  if (!sharedBrowser) {
    sharedBrowser = await playwrightModule.chromium.launch({ headless: true });
  }

  const context: BrowserContext = await sharedBrowser.newContext({
    javaScriptEnabled: true,
    bypassCSP: false,
    ignoreHTTPSErrors: false,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  const page = await context.newPage();
  const consoleLog: ConsoleEntry[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    consoleLog.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err: Error) => {
    consoleLog.push({ type: 'error', text: err.message });
  });

  const session: BrowserSession = {
    page,
    context,
    snapshot: { compact: '', full: '', elements: [], refSelectors: new Map() },
    consoleLog,
    lastActivity: Date.now(),
  };
  sessions.set(sessionId, session);
  ensureCleanupTimer();
  return session;
}

async function withTimeout<T>(fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Browser operation timed out.')), OP_TIMEOUT_MS),
    ),
  ]);
}

async function refreshSnapshot(session: BrowserSession): Promise<SnapshotResult> {
  const elements = await session.page.evaluate(() => {
    const interactive = document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"], [role="link"]',
    );
    return Array.from(interactive).map((el, i) => {
      const tag = el.tagName.toLowerCase();
      const name = (el as HTMLInputElement).value
        || el.getAttribute('aria-label')
        || el.textContent?.trim()
        || '';
      return { ref: `@e${i + 1}`, tag, name: name.slice(0, 80) };
    });
  });
  const fullText = await session.page.innerText('body').catch(() => '');
  const refSelectors = new Map<string, string>();
  const snapElements = elements.map((e, i) => {
    const ref = `@e${i + 1}`;
    refSelectors.set(ref, `[data-carina-ref="${i + 1}"]`);
    return { ref, tag: e.tag, role: e.tag, name: e.name };
  });
  await session.page.evaluate(() => {
    const interactive = document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"], [role="link"]',
    );
    interactive.forEach((el, i) => el.setAttribute('data-carina-ref', String(i + 1)));
  });
  const compactLines = snapElements.map((e) => `${e.ref} [${e.tag}] ${e.name}`.trim());
  const compact = compactLines.join('\n') || '(no interactive elements)';
  session.snapshot = {
    compact: compact.length > 8000 ? `${compact.slice(0, 8000)}\n[truncated]` : compact,
    full: fullText.length > 8000 ? `${fullText.slice(0, 8000)}\n[truncated]` : fullText,
    elements: snapElements,
    refSelectors,
  };
  return session.snapshot;
}

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

export async function browserClick(sessionId: string, ref: string): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    const selector = session.snapshot.refSelectors.get(ref);
    if (!selector) return { error: `Unknown ref: ${ref}. Take a snapshot first.` };
    await withTimeout(() => session.page.locator(selector).click());
    const snap = await refreshSnapshot(session);
    return { clicked: ref, snapshot: snap.compact };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function browserType(sessionId: string, ref: string, text: string): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    const selector = session.snapshot.refSelectors.get(ref);
    if (!selector) return { error: `Unknown ref: ${ref}. Take a snapshot first.` };
    await withTimeout(() => session.page.locator(selector).fill(text));
    return { typed: text, ref };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function browserPress(sessionId: string, key: string): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    await withTimeout(() => session.page.keyboard.press(key));
    const snap = await refreshSnapshot(session);
    return { pressed: key, snapshot: snap.compact };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function browserScroll(sessionId: string, direction: 'up' | 'down'): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    const delta = direction === 'down' ? 400 : -400;
    await withTimeout(() => session.page.mouse.wheel(0, delta));
    return { scrolled: direction };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function browserSnapshot(sessionId: string, full = false): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    const snap = await refreshSnapshot(session);
    return { snapshot: full ? snap.full : snap.compact, elementCount: snap.elements.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function browserConsole(
  sessionId: string,
  clear = false,
  expression?: string,
): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    if (expression) {
      try {
        const result = await withTimeout(() => session.page.evaluate(expression));
        return { evaluated: result };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }
    const log = [...session.consoleLog];
    if (clear) session.consoleLog.length = 0;
    return { console: log };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function browserBack(sessionId: string): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    await withTimeout(() => session.page.goBack());
    const url = session.page.url();
    await assertNavigationAllowed(url);
    const snap = await refreshSnapshot(session);
    return { url, snapshot: snap.compact };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function browserGetImages(sessionId: string): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    const images = await withTimeout(() =>
      session.page.$$eval('img', (els) =>
        els.map((el) => ({
          url: (el as HTMLImageElement).src,
          alt: (el as HTMLImageElement).alt,
        })),
      ),
    );
    return { images };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export function clearBrowserSession(sessionId: string): void {
  void destroyBrowserSession(sessionId);
}

export async function getBrowserPage(sessionId: string): Promise<Page> {
  const session = await getOrCreateSession(sessionId);
  return session.page;
}

export async function browserVision(
  sessionId: string,
  prompt = 'Describe what is visible on this page.',
): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    const screenshot = await withTimeout(() => session.page.screenshot({ type: 'png' }));
    const { visionAnalyzeTool } = await import('../vision-analyze.js');
    const tmpPath = tempFile(`carina-browser-${sessionId.replace(/[^a-z0-9-]/gi, '-')}.png`);
    const fs = await import('fs/promises');
    await fs.writeFile(tmpPath, screenshot);
    try {
      const result = await visionAnalyzeTool.execute({ path: tmpPath, prompt });
      return { url: session.page.url(), analysis: result };
    } finally {
      await fs.unlink(tmpPath).catch(() => undefined);
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function browserCdp(
  sessionId: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    const client = await session.page.context().newCDPSession(session.page);
    try {
      const result = await withTimeout(() =>
        client.send(method as Parameters<typeof client.send>[0], params as never),
      );
      return { method, result };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), method };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function browserDialog(
  sessionId: string,
  action: 'accept' | 'dismiss',
  promptText?: string,
): Promise<object> {
  try {
    const session = await getOrCreateSession(sessionId);
    let handled = false;
    session.page.once('dialog', async (dialog) => {
      handled = true;
      if (action === 'accept') {
        await dialog.accept(promptText);
      } else {
        await dialog.dismiss();
      }
    });
    await withTimeout(() => session.page.keyboard.press('Enter').catch(() => undefined));
    return { action, handled, message: handled ? 'dialog handled' : 'no dialog appeared' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

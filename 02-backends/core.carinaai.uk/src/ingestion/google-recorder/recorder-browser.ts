import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  GOOGLE_RECORDER_URL,
  googleRecorderFixtureDir,
  googleRecorderHeadless,
  googleRecorderPollLimit,
} from './recorder-config.js';

export interface RecorderListingItem {
  id: string;
  title: string;
  recordedAt?: string;
  detailUrl?: string;
  transcript?: string;
  audioPath?: string;
}

export interface RecorderFetchResult {
  items: RecorderListingItem[];
  sessionValid: boolean;
  error?: string;
}

type ScrapedRow = { id: string; title: string; href: string };

async function loadFixtureListings(knownIds: ReadonlySet<string>): Promise<RecorderFetchResult> {
  const dir = googleRecorderFixtureDir();
  if (!dir) {
    return { items: [], sessionValid: false, error: 'fixture dir not set' };
  }
  const listPath = path.join(dir, 'listings.json');
  const raw = await fs.readFile(listPath, 'utf8');
  const parsed = JSON.parse(raw) as { items?: RecorderListingItem[] };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return {
    items: items.filter((item) => !knownIds.has(item.id)).slice(0, googleRecorderPollLimit()),
    sessionValid: true,
  };
}

async function scrapeList(page: {
  evaluate: (fn: () => ScrapedRow[]) => Promise<ScrapedRow[]>;
}): Promise<ScrapedRow[]> {
  return page.evaluate(() => {
    const out: ScrapedRow[] = [];
    const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    for (const a of anchors) {
      const href = a.href || '';
      if (!href.includes('recorder.google.com')) continue;
      const match =
        href.match(/\/sharing\/([A-Za-z0-9_-]+)/) || href.match(/[?&]id=([A-Za-z0-9_-]+)/);
      const id = match?.[1] || '';
      const title = (a.textContent || a.getAttribute('aria-label') || '').trim();
      if (!id || !title) continue;
      if (out.some((row) => row.id === id)) continue;
      out.push({ id, title: title.slice(0, 200), href });
    }
    if (out.length === 0) {
      const cards = Array.from(
        document.querySelectorAll('[role="listitem"], [data-recording-id], article, li'),
      );
      let i = 0;
      for (const card of cards) {
        const text = (card.textContent || '').trim().replace(/\s+/g, ' ');
        if (text.length < 4 || text.length > 300) continue;
        const dataId = card.getAttribute('data-recording-id') || '';
        const id = dataId || `dom-${Date.now()}-${i++}`;
        if (out.some((row) => row.id === id)) continue;
        out.push({ id, title: text.slice(0, 200), href: '' });
      }
    }
    return out;
  });
}

/**
 * Fetch recordings from recorder.google.com using a Playwright storageState.
 * Google has no public Recorder API; this is UI automation and can break when Google changes the page.
 */
export async function fetchRecorderListings(input: {
  storageState: object;
  knownIds: ReadonlySet<string>;
}): Promise<RecorderFetchResult> {
  if (googleRecorderFixtureDir()) {
    return loadFixtureListings(input.knownIds);
  }

  let playwright: typeof import('playwright');
  try {
    playwright = await import('playwright');
  } catch {
    return {
      items: [],
      sessionValid: false,
      error: 'Playwright is not installed. Run: pnpm add playwright && npx playwright install chromium',
    };
  }

  const browser = await playwright.chromium.launch({ headless: googleRecorderHeadless() });
  const context = await browser.newContext({
    // Playwright StorageState shape from interactive login script
    storageState: input.storageState as never,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aiva-recorder-'));

  try {
    await page.goto(GOOGLE_RECORDER_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2_500);

    const url = page.url();
    if (url.includes('accounts.google.com') || url.includes('ServiceLogin')) {
      return {
        items: [],
        sessionValid: false,
        error: 'Google session expired. Re-upload a fresh Playwright storageState for recorder.google.com',
      };
    }

    const normalized = await scrapeList(page);
    const candidates = normalized
      .filter((row) => !input.knownIds.has(row.id))
      .slice(0, googleRecorderPollLimit());

    const items: RecorderListingItem[] = [];
    for (const candidate of candidates) {
      const item: RecorderListingItem = {
        id: candidate.id,
        title: candidate.title || `Recording ${candidate.id}`,
        detailUrl: candidate.href || undefined,
      };

      if (candidate.href) {
        try {
          await page.goto(candidate.href, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          await page.waitForTimeout(1_500);
          const transcript = await page.evaluate(() => {
            const main = document.querySelector('main') || document.body;
            return (main?.innerText || '').trim().slice(0, 100_000);
          });
          if (transcript.length > 40) {
            item.transcript = transcript;
          }

          const downloadPromise = page
            .waitForEvent('download', { timeout: 8_000 })
            .then(async (download) => {
              const suggested = download.suggestedFilename();
              const ext = path.extname(suggested) || '.m4a';
              const target = path.join(tmpRoot, `${candidate.id}${ext}`);
              await download.saveAs(target);
              return target;
            })
            .catch(() => null);

          const downloadButton = page.getByRole('button', { name: /download|export|save/i }).first();
          if (await downloadButton.count()) {
            await downloadButton.click({ timeout: 3_000 }).catch(() => undefined);
            const audioPath = await downloadPromise;
            if (audioPath) item.audioPath = audioPath;
          }
        } catch (err) {
          console.warn(
            `[google-recorder] detail fetch failed for ${candidate.id}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      items.push(item);
    }

    return { items, sessionValid: true };
  } catch (err) {
    return {
      items: [],
      sessionValid: true,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

#!/usr/bin/env node
/**
 * Interactive login for Google Recorder → Aiva Path A.
 *
 * Usage:
 *   node scripts/google-recorder-login.mjs [output-path]
 *
 * Opens Chromium. Sign in to Google, open recorder.google.com, confirm recordings load,
 * then press Enter in this terminal. Writes Playwright storageState JSON for
 * POST /api/aiva/google-recorder/connect
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { chromium } from 'playwright';

const outPath = path.resolve(
  process.argv[2] || path.join(process.cwd(), 'google-recorder-storage-state.json'),
);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://recorder.google.com/', { waitUntil: 'domcontentloaded' });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await new Promise((resolve) => {
  rl.question(
    'Sign in, confirm recorder.google.com shows your recordings, then press Enter here... ',
    () => resolve(undefined),
  );
});
rl.close();

const state = await context.storageState();
fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
await browser.close();
console.log(`Wrote storageState to ${outPath}`);
console.log('Upload via POST /api/aiva/google-recorder/connect with { workerId, workspaceId, storageState }');

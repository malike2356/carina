import type { Tool } from '../types/index.js';
import { getBrowserPage, checkPlaywright } from './browser/session.js';

export function isComputerUseEnabled(): boolean {
  if (process.env.CARINA_COMPUTER_USE_ENABLED !== 'true') return false;
  if (process.env.LABYRINTH_ENABLED === 'true' && process.env.CARINA_COMPUTER_USE_SCOUT_ALLOW !== 'true') {
    return false;
  }
  return true;
}

export const computerUseTool: Tool = {
  name: 'computer-use',
  description:
    'Desktop-style automation via Playwright (screenshot, click, type). Requires CARINA_COMPUTER_USE_ENABLED=true. High risk: Scout approval recommended.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['screenshot', 'click', 'type', 'navigate'],
      },
      url: { type: 'string', description: 'For navigate action' },
      x: { type: 'number' },
      y: { type: 'number' },
      text: { type: 'string' },
      selector: { type: 'string', description: 'CSS selector alternative to x/y click' },
    },
    required: ['action'],
  },
  dangerous: true,
  requiresConfirmation: true,
  execute: async (params) => {
    if (!isComputerUseEnabled()) {
      return {
        error: 'Computer use disabled. Set CARINA_COMPUTER_USE_ENABLED=true'
          + (process.env.LABYRINTH_ENABLED === 'true' ? ' and CARINA_COMPUTER_USE_SCOUT_ALLOW=true' : ''),
      };
    }

    const available = await checkPlaywright();
    if (!available) return { error: 'Playwright not available' };

    const action = String(params.action ?? '');
    const page = await getBrowserPage('computer-use');

    if (action === 'navigate') {
      const url = String(params.url ?? '').trim();
      if (!url) return { error: 'url is required' };
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      return { navigated: url, title: await page.title() };
    }

    if (action === 'screenshot') {
      const buffer = await page.screenshot({ type: 'png' });
      const b64 = buffer.toString('base64');
      return { format: 'png', base64: b64.slice(0, 200) + '...[truncated]', bytes: buffer.length };
    }

    if (action === 'click') {
      const selector = params.selector ? String(params.selector) : '';
      if (selector) {
        await page.click(selector, { timeout: 10_000 });
        return { clicked: selector };
      }
      const x = Number(params.x);
      const y = Number(params.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { error: 'selector or x/y coordinates required' };
      }
      await page.mouse.click(x, y);
      return { clicked: { x, y } };
    }

    if (action === 'type') {
      const text = String(params.text ?? '');
      if (!text) return { error: 'text is required' };
      await page.keyboard.type(text);
      return { typed: text.length };
    }

    return { error: `unknown action: ${action}` };
  },
};

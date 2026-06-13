import type { Tool } from '../../types/index.js';
import {
  browserBack,
  browserClick,
  browserConsole,
  browserGetImages,
  browserNavigate,
  browserPress,
  browserScroll,
  browserSnapshot,
  browserType,
  browserVision,
  browserCdp,
  browserDialog,
} from './session.js';

function sessionFromParams(params: Record<string, unknown>): string {
  return String(params._sessionId ?? 'default-browser');
}

export function createBrowserTools(_sessionId = 'default-browser'): Tool[] {
  return [
    {
      name: 'browser-navigate',
      dangerous: true,
      requiresConfirmation: true,
      description:
        'Navigate to a URL. Initializes a Playwright Chromium session (requires Playwright installed: pnpm add playwright && npx playwright install chromium). Returns a compact snapshot with interactive element ref IDs. Must be called before any other browser tool. For plain-text endpoints (.md, .txt, .json), prefer http-request or shell-exec instead.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
      execute: async (params) => browserNavigate(sessionFromParams(params), String(params.url ?? '')),
    },
    {
      name: 'browser-click',
      dangerous: true,
      description: 'Click an element by ref ID from snapshot (e.g. @e5).',
      parameters: {
        type: 'object',
        properties: { ref: { type: 'string' } },
        required: ['ref'],
      },
      execute: async (params) => browserClick(sessionFromParams(params), String(params.ref ?? '')),
    },
    {
      name: 'browser-type',
      dangerous: true,
      description: 'Type text into an input field by ref. Clears first, then types.',
      parameters: {
        type: 'object',
        properties: {
          ref: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['ref', 'text'],
      },
      execute: async (params) =>
        browserType(sessionFromParams(params), String(params.ref ?? ''), String(params.text ?? '')),
    },
    {
      name: 'browser-press',
      dangerous: true,
      description: 'Press a keyboard key (Enter, Tab, Escape, ArrowDown).',
      parameters: {
        type: 'object',
        properties: { key: { type: 'string' } },
        required: ['key'],
      },
      execute: async (params) => browserPress(sessionFromParams(params), String(params.key ?? '')),
    },
    {
      name: 'browser-scroll',
      dangerous: true,
      description: 'Scroll the page up or down.',
      parameters: {
        type: 'object',
        properties: { direction: { type: 'string', enum: ['up', 'down'] } },
        required: ['direction'],
      },
      execute: async (params) =>
        browserScroll(sessionFromParams(params), String(params.direction ?? 'down') as 'up' | 'down'),
    },
    {
      name: 'browser-snapshot',
      description: 'Get text-based accessibility tree snapshot.',
      parameters: {
        type: 'object',
        properties: { full: { type: 'boolean', description: 'Full page text (default: compact interactive only)' } },
      },
      execute: async (params) =>
        browserSnapshot(sessionFromParams(params), Boolean(params.full)),
    },
    {
      name: 'browser-console',
      description: 'Get console output and JS errors. Optionally evaluate JS in page context.',
      parameters: {
        type: 'object',
        properties: {
          clear: { type: 'boolean' },
          expression: { type: 'string', description: 'JS expression to evaluate' },
        },
      },
      execute: async (params) =>
        browserConsole(
          sessionFromParams(params),
          Boolean(params.clear),
          params.expression ? String(params.expression) : undefined,
        ),
    },
    {
      name: 'browser-back',
      description: 'Navigate back in browser history.',
      parameters: { type: 'object', properties: {} },
      execute: async (params) => browserBack(sessionFromParams(params)),
    },
    {
      name: 'browser-get-images',
      description: 'Get all images on current page with URLs and alt text.',
      parameters: { type: 'object', properties: {} },
      execute: async (params) => browserGetImages(sessionFromParams(params)),
    },
    {
      name: 'browser-vision',
      dangerous: true,
      description: 'Capture a screenshot of the current page and analyze it with a vision LLM.',
      parameters: {
        type: 'object',
        properties: { prompt: { type: 'string', description: 'Question about the page visual' } },
      },
      execute: async (params) =>
        browserVision(
          sessionFromParams(params),
          params.prompt ? String(params.prompt) : undefined,
        ),
    },
    {
      name: 'browser-cdp',
      dangerous: true,
      requiresConfirmation: true,
      description: 'Send a Chrome DevTools Protocol command to the active browser page.',
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', description: 'CDP method name, e.g. Page.captureScreenshot' },
          params: { type: 'object', description: 'CDP method parameters' },
        },
        required: ['method'],
      },
      execute: async (params) =>
        browserCdp(
          sessionFromParams(params),
          String(params.method ?? ''),
          (params.params ?? {}) as Record<string, unknown>,
        ),
    },
    {
      name: 'browser-dialog',
      dangerous: true,
      description: 'Accept or dismiss the next JavaScript dialog (alert, confirm, prompt).',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['accept', 'dismiss'] },
          prompt_text: { type: 'string', description: 'Text for prompt dialogs when accepting' },
        },
        required: ['action'],
      },
      execute: async (params) =>
        browserDialog(
          sessionFromParams(params),
          String(params.action ?? 'accept') as 'accept' | 'dismiss',
          params.prompt_text ? String(params.prompt_text) : undefined,
        ),
    },
  ];
}

export const browserTools: Tool[] = createBrowserTools();

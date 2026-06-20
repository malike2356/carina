import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';

export type DebugCapture = {
  id: string;
  at: string;
  direction: 'request' | 'response';
  method: string;
  url: string;
  statusCode?: number;
  provider?: string;
  bodyPreview: string;
  bytes: number;
};

type CaptureStore = {
  version: number;
  captures: DebugCapture[];
  proxiedProviders: string[];
};

const STORE_PATH = path.join(CARINA_HOME, 'debug-captures.json');
const MAX_CAPTURES = 500;
let cached: CaptureStore | null = null;

function loadStore(): CaptureStore {
  if (cached) return cached;
  if (!fs.existsSync(STORE_PATH)) {
    cached = { version: 1, captures: [], proxiedProviders: [] };
    return cached;
  }
  try {
    cached = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as CaptureStore;
    cached.captures = cached.captures ?? [];
    cached.proxiedProviders = cached.proxiedProviders ?? [];
    return cached;
  } catch {
    cached = { version: 1, captures: [], proxiedProviders: [] };
    return cached;
  }
}

function saveStore(store: CaptureStore): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
  cached = store;
}

export function debugCaptureEnabled(): boolean {
  return process.env.CARINA_DEBUG_PROXY_CAPTURE === 'true';
}

export function debugProxyProviderFilter(): string[] | null {
  const raw = process.env.CARINA_DEBUG_PROXY_PROVIDERS?.trim();
  if (!raw || raw === '*') return null;
  return raw.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
}

export function isProviderCaptured(provider?: string): boolean {
  const filter = debugProxyProviderFilter();
  if (!filter) return true;
  if (!provider) return false;
  return filter.includes(provider.toLowerCase());
}

export function inferProviderFromUrl(url: string): string | undefined {
  if (/openai\.com|api\.openai/i.test(url)) return 'openai';
  if (/anthropic\.com/i.test(url)) return 'anthropic';
  if (/deepseek\.com/i.test(url)) return 'deepseek';
  if (/generativelanguage\.googleapis/i.test(url)) return 'gemini';
  if (/127\.0\.0\.1:11434|ollama/i.test(url)) return 'ollama';
  if (/127\.0\.0\.1:1234|lmstudio/i.test(url)) return 'lmstudio';
  return undefined;
}

export function recordDebugCapture(input: Omit<DebugCapture, 'id' | 'at'>): DebugCapture | null {
  const store = loadStore();
  const provider = input.provider ?? inferProviderFromUrl(input.url);
  if (!isProviderCaptured(provider)) return null;
  const entry: DebugCapture = {
    ...input,
    provider,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  };
  store.captures.push(entry);
  if (entry.provider && !store.proxiedProviders.includes(entry.provider)) {
    store.proxiedProviders.push(entry.provider);
  }
  if (store.captures.length > MAX_CAPTURES) {
    store.captures = store.captures.slice(-MAX_CAPTURES);
  }
  saveStore(store);
  return entry;
}

export function listDebugCaptures(limit = 50): DebugCapture[] {
  return loadStore().captures.slice(-limit).reverse();
}

export function getDebugCapture(id: string): DebugCapture | undefined {
  return loadStore().captures.find((c) => c.id === id);
}

export function listProxiedProviders(): string[] {
  return [...loadStore().proxiedProviders];
}

export function purgeDebugCaptures(): number {
  const store = loadStore();
  const n = store.captures.length;
  store.captures = [];
  store.proxiedProviders = [];
  saveStore(store);
  return n;
}

export function resetDebugCaptureCache(): void {
  cached = null;
}

export function redactBodyPreview(raw: string, max = 512): string {
  return raw
    .replace(/("api[_-]?key"\s*:\s*")[^"]+"/gi, '$1<redacted>"')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1<redacted>')
    .slice(0, max);
}

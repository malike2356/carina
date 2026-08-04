/**
 * Per-session active working set: tool evidence that must survive into the
 * next turn as FIXED prompt context (not trimmed with history).
 *
 * Episodic digests alone are not enough: durable USER/MEMORY stays in fixedParts
 * while history is first to be cut. This store sits in fixedParts with clear
 * priority over older curated notes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveCarinaDataDir } from '../config/paths.js';
import { isEvidenceTool } from './tool-working-set.js';

export type SessionWorkingSetItem = {
  id: string;
  toolName: string;
  title: string;
  excerpt: string;
  updatedAt: number;
};

type SessionWorkingSetState = {
  sessionId: string;
  items: SessionWorkingSetItem[];
  updatedAt: number;
};

const MAX_ITEMS = 12;
const MAX_EXCERPT = 2_400;
const MAX_PROMPT_CHARS = 14_000;
const cache = new Map<string, SessionWorkingSetState>();

function storeDir(): string {
  return path.join(resolveCarinaDataDir(), 'session-working-sets');
}

/** Nest Aiva working sets under worker id so tenants never share a flat dump. */
function storePath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9._:-]+/g, '_').slice(0, 180);
  const aivaMatch = sessionId.match(/^aiva-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-/i);
  if (aivaMatch) {
    return path.join(storeDir(), 'aiva', aivaMatch[1].toLowerCase(), `${safe}.json`);
  }
  return path.join(storeDir(), `${safe}.json`);
}

function legacyFlatStorePath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9._:-]+/g, '_').slice(0, 180);
  return path.join(storeDir(), `${safe}.json`);
}

function loadState(sessionId: string): SessionWorkingSetState {
  const cached = cache.get(sessionId);
  if (cached) return cached;
  const empty: SessionWorkingSetState = { sessionId, items: [], updatedAt: 0 };
  const candidates = [storePath(sessionId)];
  const nested = storePath(sessionId);
  const flat = legacyFlatStorePath(sessionId);
  if (nested !== flat) candidates.push(flat);
  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as SessionWorkingSetState;
      if (parsed && Array.isArray(parsed.items)) {
        const state: SessionWorkingSetState = {
          sessionId,
          items: parsed.items.slice(-MAX_ITEMS),
          updatedAt: Number(parsed.updatedAt) || 0,
        };
        cache.set(sessionId, state);
        return state;
      }
    } catch {
      // try next candidate
    }
  }
  cache.set(sessionId, empty);
  return empty;
}

function persist(state: SessionWorkingSetState): void {
  cache.set(state.sessionId, state);
  try {
    const filePath = storePath(state.sessionId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state), 'utf8');
  } catch {
    // disk persistence best-effort; in-memory still serves the live process
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return '';
}

export function extractWorkingSetItem(
  toolName: string,
  result: unknown,
): SessionWorkingSetItem | null {
  if (!isEvidenceTool(toolName)) return null;
  const record = asRecord(result);
  let title = toolName;
  let excerpt = '';

  if (typeof result === 'string') {
    excerpt = result.trim();
  } else if (record) {
    if (record.error) return null;
    if (
      (toolName === 'contacts' || toolName === 'google-contacts')
      && Array.isArray(record.contacts)
    ) {
      const query = pickString(record, ['query']) || 'contacts';
      const names = Array.isArray(record.match_names)
        ? record.match_names.map((n) => String(n)).filter(Boolean)
        : (record.contacts as Array<Record<string, unknown>>)
          .map((c) => String(c.name ?? '').trim())
          .filter(Boolean);
      title = `contacts:${query}`;
      excerpt = [
        String(record.answer_rule ?? ''),
        `query=${query}`,
        `count=${Number(record.count ?? names.length) || 0}`,
        names.length ? `matches: ${names.slice(0, 12).join('; ')}` : 'matches: (none)',
      ].filter(Boolean).join('\n');
    } else {
      title = pickString(record, ['name', 'title', 'fileName', 'filename', 'path', 'id', 'query'])
        || toolName;
      excerpt = pickString(record, ['text', 'content', 'body', 'output', 'snippet', 'summary']);
      if (!excerpt) {
        try {
          excerpt = JSON.stringify(record);
        } catch {
          excerpt = String(result);
        }
      }
    }
  } else if (result != null) {
    excerpt = String(result);
  }

  excerpt = excerpt.replace(/\s+/g, ' ').trim();
  if (!excerpt) return null;

  const id = `${toolName}:${title}`.slice(0, 200);
  return {
    id,
    toolName,
    title: title.slice(0, 160),
    excerpt: excerpt.slice(0, MAX_EXCERPT),
    updatedAt: Date.now(),
  };
}

export function recordSessionWorkingSetEvidence(
  sessionId: string,
  toolName: string,
  result: unknown,
): SessionWorkingSetItem | null {
  if (!sessionId) return null;
  const item = extractWorkingSetItem(toolName, result);
  if (!item) return null;

  const state = loadState(sessionId);
  // A new contacts hit replaces older people evidence so prior chats cannot stick.
  const without = (/^contacts$/i.test(toolName) || /^google-contacts$/i.test(toolName))
    ? state.items.filter((existing) =>
      !/^contacts$/i.test(existing.toolName) && !/^google-contacts$/i.test(existing.toolName))
    : state.items.filter((existing) => existing.id !== item.id);
  without.push(item);
  state.items = without.slice(-MAX_ITEMS);
  state.updatedAt = Date.now();
  persist(state);
  return item;
}

export function getSessionWorkingSet(sessionId: string): SessionWorkingSetItem[] {
  if (!sessionId) return [];
  return loadState(sessionId).items;
}

export function clearSessionWorkingSet(sessionId: string): void {
  cache.delete(sessionId);
  for (const filePath of [storePath(sessionId), legacyFlatStorePath(sessionId)]) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
}

export function formatSessionWorkingSetForPrompt(
  sessionId: string,
  maxChars = MAX_PROMPT_CHARS,
): string {
  const items = getSessionWorkingSet(sessionId);
  if (items.length === 0) return '';

  const header = [
    'ACTIVE WORKING SET (this conversation; authoritative for follow-ups):',
    '- Prefer this block over older durable USER/MEMORY notes when they conflict.',
    '- Continue from these documents/results. Do not restart with unrelated tools or topics.',
    `- Items: ${items.length}`,
  ].join('\n');

  const blocks = items.map((item, i) => (
    `${i + 1}. [${item.toolName}] ${item.title}\n${item.excerpt}`
  ));

  let body = `${header}\n\n${blocks.join('\n\n')}`;
  if (body.length > maxChars) {
    body = `${body.slice(0, maxChars)}\n[working set truncated for prompt size]`;
  }
  return body;
}

/**
 * When a working set is active, shrink always-on durable memory so it cannot
 * drown recent tool evidence under context budget pressure.
 * Only the Hermes durable block is capped; persona/tools/bridge stay intact.
 */
export function demoteDurableMemorySuffix(
  suffix: string,
  opts: { workingSetActive: boolean; maxChars?: number },
): string {
  if (!opts.workingSetActive || !suffix.trim()) return suffix;
  const marker = 'Durable memory (Hermes-style clear split):';
  const idx = suffix.indexOf(marker);
  if (idx < 0) return suffix;
  const before = suffix.slice(0, idx);
  const durable = suffix.slice(idx);
  const maxChars = opts.maxChars ?? 2_500;
  const note =
    '\n[Durable memory demoted: ACTIVE WORKING SET is authoritative for this conversation.]';
  if (durable.length <= maxChars) return `${before}${durable}${note}`;
  return `${before}${durable.slice(0, maxChars)}\n[durable memory truncated]${note}`;
}

export function stripWorkingSetDigestsFromHistory(content: string): string {
  // Avoid double-injecting the older episodic digest format into trimable history.
  return content
    .replace(/\n?\n?Working set from this turn \(tool evidence; prefer over older memory notes\):[\s\S]*?(?=\n(?:user|assistant):|\s*$)/g, '')
    .replace(/\n?\n?Working set updated \(\d+ tool results\)\. Full evidence is in ACTIVE WORKING SET for follow-ups\.?/gi, '')
    .trim();
}

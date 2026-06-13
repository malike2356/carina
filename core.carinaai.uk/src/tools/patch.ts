import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '../types/index.js';
import { expandPath, isBlockedSystemWrite, isSafePath, resolveResourcePath } from './path-utils.js';
import { collectSyntaxErrors, newSyntaxErrors } from './file-syntax.js';

type MatchResult = { index: number; length: number; strategy: string };

function findExact(content: string, needle: string, strategy = 'exact'): MatchResult[] {
  const matches: MatchResult[] = [];
  let pos = 0;
  while (true) {
    const idx = content.indexOf(needle, pos);
    if (idx === -1) break;
    matches.push({ index: idx, length: needle.length, strategy });
    pos = idx + needle.length;
  }
  return matches;
}

function needleVariants(needle: string): Array<[string, string]> {
  const variants: Array<[string, string]> = [['exact', needle]];
  const crlf = needle.replace(/\r\n/g, '\n');
  if (crlf !== needle) variants.push(['crlf-normalized', crlf]);
  const lfToCrlf = needle.replace(/\n/g, '\r\n');
  if (lfToCrlf !== needle) variants.push(['lf-to-crlf', lfToCrlf]);
  const detab = needle.replace(/\t/g, '  ');
  if (detab !== needle) variants.push(['tab-to-spaces', detab]);
  const trimmed = needle.trim();
  if (trimmed !== needle) variants.push(['trim-whitespace', trimmed]);
  return variants;
}

function findMatch(content: string, needle: string): MatchResult[] {
  for (const [strategy, variant] of needleVariants(needle)) {
    const matches = findExact(content, variant, strategy);
    if (matches.length > 0) return matches;
  }
  return [];
}

function applyReplacements(
  content: string,
  matches: MatchResult[],
  replacement: string,
  replaceAll: boolean,
): string {
  if (matches.length === 0) return content;
  if (!replaceAll && matches.length > 1) {
    throw new Error(`old_string matches ${matches.length} locations; set replace_all=true or make old_string unique.`);
  }

  const toApply = replaceAll ? matches : [matches[0]];
  let result = content;
  let offset = 0;
  for (const match of toApply) {
    const start = match.index + offset;
    result = result.slice(0, start) + replacement + result.slice(start + match.length);
    offset += replacement.length - match.length;
  }
  return result;
}

function buildDiff(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const lines: string[] = ['--- before', '+++ after'];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === a) continue;
    if (b !== undefined) lines.push(`-${b}`);
    if (a !== undefined) lines.push(`+${a}`);
  }
  return lines.join('\n');
}

export const patchTool: Tool = {
  name: 'patch',
  dangerous: true,
  requiresConfirmation: true,
  description:
    'Apply a find-and-replace edit to a file. old_string must match exactly one location - if it matches multiple, use replace_all=true or make old_string longer and more unique. Tries exact match first, then fuzzy variants (CRLF normalisation, tab-to-spaces, whitespace trim). Returns a diff and flags any new syntax errors introduced. Cannot create new files - use file-write for that.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or ~/ path to the file' },
      old_string: { type: 'string', description: 'Text to find' },
      new_string: { type: 'string', description: 'Replacement text' },
      replace_all: { type: 'boolean', description: 'Replace all occurrences (default false)' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  needsConfirmation: async (params) => {
    const filePath = resolveResourcePath(expandPath(String(params.path ?? '')));
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  execute: async (params) => {
    const filePath = resolveResourcePath(expandPath(String(params.path ?? '')));
    const oldString = String(params.old_string ?? '');
    const newString = String(params.new_string ?? '');
    const replaceAll = params.replace_all === true;

    if (!isSafePath(filePath) || isBlockedSystemWrite(filePath)) {
      return { error: 'cannot patch this path' };
    }
    if (!oldString) return { error: 'old_string is required' };

    let priorContent = '';
    let existed = false;
    try {
      priorContent = await fs.readFile(filePath, 'utf8');
      existed = true;
    } catch {
      return { error: `file not found: ${filePath}` };
    }

    const priorErrors = await collectSyntaxErrors(filePath, priorContent);

    let matches: MatchResult[];
    try {
      matches = findMatch(priorContent, oldString);
      if (matches.length === 0) {
        return { error: 'old_string not found in file (exact and fuzzy strategies exhausted)' };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }

    let updated: string;
    try {
      updated = applyReplacements(priorContent, matches, newString, replaceAll);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
    await fs.writeFile(filePath, updated, 'utf8');

    const afterErrors = await collectSyntaxErrors(filePath, updated);
    const introduced = newSyntaxErrors(priorErrors, afterErrors);

    return {
      path: filePath,
      strategy: matches[0].strategy,
      replacements: replaceAll ? matches.length : 1,
      diff: buildDiff(priorContent, updated),
      syntax_errors: introduced.length > 0 ? introduced : undefined,
      note: existed ? undefined : 'created new file',
    };
  },
};

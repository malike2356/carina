import type { ProcessWatchRule } from './process-types.js';

export interface WatchMatch {
  rule: ProcessWatchRule;
  line: string;
}

export function compileWatchRule(rule: ProcessWatchRule): RegExp | null {
  try {
    return new RegExp(rule.pattern, rule.flags ?? 'i');
  } catch {
    return null;
  }
}

export function findWatchMatches(
  rules: ProcessWatchRule[],
  lines: string[],
  alreadyMatched: Set<string>,
): WatchMatch[] {
  const matches: WatchMatch[] = [];
  for (const rule of rules) {
    const key = `${rule.pattern}:${rule.flags ?? 'i'}`;
    if (rule.once !== false && alreadyMatched.has(key)) continue;
    const regex = compileWatchRule(rule);
    if (!regex) continue;
    for (const line of lines) {
      if (regex.test(line)) {
        matches.push({ rule, line });
        alreadyMatched.add(key);
        break;
      }
    }
  }
  return matches;
}

export function formatWatchMessage(rule: ProcessWatchRule, line: string, command: string): string {
  const prefix = rule.message ?? '[Carina] Background process watch matched';
  return `${prefix}: ${command}\n${line}`;
}

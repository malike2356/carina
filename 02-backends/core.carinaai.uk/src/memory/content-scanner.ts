import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { InjectionPattern } from '../security/prompt-guard.js';

export type MemoryContentSource = 'user' | 'tool_result' | 'inference';

export type ContentScanResult =
  | { blocked: false }
  | { blocked: true; patternId: string; severity: string; description: string };

interface CompiledPattern {
  id: string;
  regex: RegExp;
  severity: string;
  description: string;
}

const MEMORY_SPECIFIC_PATTERNS: CompiledPattern[] = [
  {
    id: 'MEM-001',
    regex: /for (all |every |future |next |subsequent |upcoming )?sessions?/i,
    severity: 'critical',
    description: 'Cross-session persistence instruction.',
  },
  {
    id: 'MEM-002',
    regex: /always (remember|do|include|add|send|cc|bcc|forward)/i,
    severity: 'critical',
    description: 'Persistent behavioral instruction.',
  },
  {
    id: 'MEM-003',
    regex: /store (this|the following|these instructions?) in (memory|your memory|context)/i,
    severity: 'critical',
    description: 'Explicit memory write instruction.',
  },
  {
    id: 'MEM-004',
    regex: /(bcc|cc|forward|copy)\s*(to|emails?|messages?)\s*(to\s*)?[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i,
    severity: 'critical',
    description: 'Email redirect instruction (common exfiltration vector in memory poisoning).',
  },
  {
    id: 'MEM-005',
    regex: /whenever (you|the agent|carina|aiva) (receive|get|send|process|see)/i,
    severity: 'high',
    description: 'Trigger-based conditional instruction.',
  },
  {
    id: 'MEM-006',
    regex: /remember (this|that|it|forever|for all (time|sessions))/i,
    severity: 'critical',
    description: 'Persistent remember instruction.',
  },
  {
    id: 'MEM-007',
    regex: /send (my |all |every )?emails? to\s+[a-zA-Z0-9._%+\-]+@/i,
    severity: 'critical',
    description: 'Email redirect instruction.',
  },
];

function loadInjectionPatterns(): InjectionPattern[] {
  const localFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../security/injection-patterns.json',
  );
  const file = fs.existsSync(localFile)
    ? localFile
    : path.join(process.cwd(), 'src', 'security', 'injection-patterns.json');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as { patterns?: InjectionPattern[] };
    return parsed.patterns ?? [];
  } catch {
    return [];
  }
}

function compileMemoryWritePatterns(): CompiledPattern[] {
  const fromLibrary = loadInjectionPatterns()
    .filter((p) => ['tool_result', 'input'].includes(p.scope))
    .filter((p) => ['critical', 'high'].includes(p.severity))
    .map((p) => ({
      id: p.id,
      regex: new RegExp(p.pattern, p.flags ?? 'i'),
      severity: p.severity,
      description: p.description,
    }));
  return [...fromLibrary, ...MEMORY_SPECIFIC_PATTERNS];
}

const ALL_PATTERNS = compileMemoryWritePatterns();

export function scanMemoryContent(
  content: string,
  source: MemoryContentSource,
): ContentScanResult {
  const patternsToApply =
    source === 'user'
      ? ALL_PATTERNS.filter((p) => p.severity === 'critical')
      : ALL_PATTERNS;

  for (const p of patternsToApply) {
    if (p.regex.test(content)) {
      return {
        blocked: true,
        patternId: p.id,
        severity: p.severity,
        description: p.description,
      };
    }
  }

  return { blocked: false };
}

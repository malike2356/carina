import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { InjectionPattern } from '../../security/prompt-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXFIL_PATTERNS = [
  /fetch\s*\(/,
  /axios\s*\./,
  /http\.get\s*\(/,
  /https\.get\s*\(/,
  /XMLHttpRequest/,
  /require\s*\(\s*['"]child_process['"]\s*\)/,
  /exec\s*\(/,
  /spawn\s*\(/,
  /process\.env\b/,
];

const SHELL_INJECTION_PATTERNS = [
  /`[^`]*\$\{/,
  /exec\s*\(\s*['"`]/,
  /execSync\s*\(/,
  /spawnSync\s*\(/,
  /\$\(\s*.*\)/,
];

const HARDCODED_CREDENTIAL_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,}/i,
  /password\s*[:=]\s*['"]?[^\s'"]{6,}/i,
  /secret\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,}/i,
];

const FILE_OPS_OUTSIDE_WORKSPACE = [
  /fs\s*\.\s*(readFile|writeFile|unlink|rm|rmdir|mkdir|rename)\s*\(\s*['"]\//,
  /require\s*\(\s*['"]fs['"]\s*\)/,
  /path\.resolve\s*\(\s*['"]\//,
];

export interface ScanVerdict {
  passed: boolean;
  badge: 'community' | 'review_required';
  flags: string[];
}

export async function scanSkillContent(content: string): Promise<ScanVerdict> {
  const flags: string[] = [];

  for (const re of EXFIL_PATTERNS) {
    if (re.test(content)) {
      flags.push(`exfiltration_pattern:${re.source.slice(0, 40)}`);
    }
  }

  for (const re of SHELL_INJECTION_PATTERNS) {
    if (re.test(content)) {
      flags.push(`shell_injection:${re.source.slice(0, 40)}`);
    }
  }

  for (const re of HARDCODED_CREDENTIAL_PATTERNS) {
    if (re.test(content)) {
      flags.push(`hardcoded_credential:${re.source.slice(0, 40)}`);
    }
  }

  for (const re of FILE_OPS_OUTSIDE_WORKSPACE) {
    if (re.test(content)) {
      flags.push(`file_op_outside_workspace:${re.source.slice(0, 40)}`);
    }
  }

  await scanWithInjectionPatterns(content, flags);

  if (process.env.CARINA_HUB_SANDBOX_SCAN === 'true') {
    const jsBlocks = extractJsBlocks(content);
    for (const block of jsBlocks) {
      const { runInSandbox } = await import('../../sandbox/sandbox-factory.js');
      const result = await runInSandbox(block, 'javascript', 5000, { networkDisabled: true });
      if (result.stderr.includes('fetch') || result.stderr.includes('http')) {
        flags.push('sandbox:network_attempt_detected');
      }
    }
  }

  const passed = flags.length === 0;
  return {
    passed,
    badge: passed ? 'community' : 'review_required',
    flags,
  };
}

async function scanWithInjectionPatterns(content: string, flags: string[]): Promise<void> {
  try {
    const patternsPath = path.resolve(__dirname, '../../security/injection-patterns.json');
    const raw = await fs.readFile(patternsPath, 'utf-8');
    const parsed = JSON.parse(raw) as { patterns?: InjectionPattern[] };
    for (const p of parsed.patterns ?? []) {
      if (p.severity === 'critical' || p.severity === 'high') {
        const re = new RegExp(p.pattern, p.flags ?? 'i');
        if (re.test(content)) {
          flags.push(`prompt_injection:${p.id}`);
        }
      }
    }
  } catch {
    // injection-patterns.json unavailable - skip layer
  }
}

function extractJsBlocks(content: string): string[] {
  const matches = content.matchAll(/```(?:js|javascript)\n([\s\S]*?)```/g);
  return [...matches].map((m) => m[1]);
}

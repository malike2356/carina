import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAllDocuments } from 'yaml';
import type { PenTestScenario, PenTestSeverity, PenTestStep } from './types.js';

const VALID_SEVERITIES = new Set<PenTestSeverity>(['critical', 'high', 'medium', 'low']);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeSteps(raw: unknown): PenTestStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: PenTestStep[] = [];
  for (const step of raw) {
    if (!step || typeof step !== 'object') continue;
    const entry = step as Record<string, unknown>;
    if (typeof entry.send_message === 'string') {
      steps.push({ send_message: entry.send_message });
      continue;
    }
    if (typeof entry.send_tool_result === 'string') {
      steps.push({ send_tool_result: entry.send_tool_result });
      continue;
    }
    if (entry.scan_memory_write && typeof entry.scan_memory_write === 'object') {
      const row = entry.scan_memory_write as Record<string, unknown>;
      const content = String(row.content ?? '');
      const source = String(row.source ?? 'tool_result');
      if (content && (source === 'user' || source === 'tool_result' || source === 'inference')) {
        steps.push({ scan_memory_write: { content, source } });
      }
      continue;
    }
    if (typeof entry.authenticate_as === 'string') {
      steps.push({ authenticate_as: entry.authenticate_as as PenTestStep extends { authenticate_as: infer R } ? R : never });
      continue;
    }
    if (typeof entry.read_path === 'string') {
      steps.push({ read_path: entry.read_path });
      continue;
    }
    if (entry.set_env && typeof entry.set_env === 'object') {
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(entry.set_env as Record<string, unknown>)) {
        env[key] = String(value);
      }
      steps.push({ set_env: env });
      continue;
    }
    if (Array.isArray(entry.simulate_tool_sequence)) {
      const sequence = entry.simulate_tool_sequence
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
        .map((row) => ({
          tool: String(row.tool ?? ''),
          params: (row.params && typeof row.params === 'object'
            ? row.params as Record<string, unknown>
            : undefined),
        }))
        .filter((row) => row.tool.length > 0);
      steps.push({ simulate_tool_sequence: sequence });
      continue;
    }
    if (typeof entry.simulate_attack === 'string') {
      steps.push({ simulate_attack: entry.simulate_attack });
      continue;
    }
    if (typeof entry.wait === 'string' || typeof entry.wait === 'number') {
      steps.push({ wait: String(entry.wait) });
      continue;
    }
    if (entry.assert && typeof entry.assert === 'object') {
      steps.push({ assert: entry.assert as PenTestStep extends { assert: infer A } ? A : never });
    }
  }
  return steps;
}

function normalizeScenario(raw: unknown, sourceFile: string): PenTestScenario | null {
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as Record<string, unknown>;
  const name = String(doc.name ?? '').trim();
  if (!name) return null;
  const severityRaw = String(doc.severity ?? 'medium').toLowerCase() as PenTestSeverity;
  const severity = VALID_SEVERITIES.has(severityRaw) ? severityRaw : 'medium';
  const id = String(doc.id ?? slugify(name)).trim() || slugify(name);
  return {
    id,
    name,
    severity,
    description: String(doc.description ?? '').trim(),
    sourceFile,
    steps: normalizeSteps(doc.steps),
  };
}

export function resolveScenariosDir(customDir?: string): string {
  if (customDir) return path.resolve(customDir);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../qa/scenarios/security');
}

export function loadScenarios(dir = resolveScenariosDir()): PenTestScenario[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .sort();
  const scenarios: PenTestScenario[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const doc of parseAllDocuments(content)) {
      const scenario = normalizeScenario(doc.toJSON(), file);
      if (scenario) scenarios.push(scenario);
    }
  }

  return scenarios;
}

export function filterScenarios(
  scenarios: PenTestScenario[],
  opts: { criticalOnly?: boolean; name?: string; id?: string },
): PenTestScenario[] {
  let filtered = scenarios;
  if (opts.criticalOnly) {
    filtered = filtered.filter((scenario) => scenario.severity === 'critical');
  }
  if (opts.name) {
    const needle = opts.name.toLowerCase();
    filtered = filtered.filter((scenario) =>
      scenario.id.toLowerCase().includes(needle)
      || scenario.name.toLowerCase().includes(needle));
  }
  if (opts.id) {
    filtered = filtered.filter((scenario) => scenario.id === opts.id);
  }
  return filtered;
}

import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { DetectionRule, SecurityGapSeverity } from './types.js';
import { detectionRulesPath, redTeamRoot } from './paths.js';

type RulesFile = {
  rules: DetectionRule[];
};

async function readRulesFile(): Promise<RulesFile> {
  try {
    return JSON.parse(await fs.readFile(detectionRulesPath(), 'utf8')) as RulesFile;
  } catch {
    return { rules: [] };
  }
}

async function writeRulesFile(file: RulesFile): Promise<void> {
  await fs.mkdir(redTeamRoot(), { recursive: true });
  await fs.writeFile(detectionRulesPath(), JSON.stringify(file, null, 2), { mode: 0o600 });
}

export async function listDetectionRules(): Promise<DetectionRule[]> {
  const file = await readRulesFile();
  return file.rules.filter((row) => row.status === 'active');
}

export async function createDetectionRule(input: {
  name: string;
  system: string;
  pattern: string;
  severity: SecurityGapSeverity;
  sourceGap?: string;
}): Promise<DetectionRule> {
  const file = await readRulesFile();
  const rule: DetectionRule = {
    id: randomUUID(),
    name: input.name,
    system: input.system,
    pattern: input.pattern,
    severity: input.severity,
    createdBy: 'red-team-automation',
    createdAt: Date.now(),
    status: 'active',
    sourceGap: input.sourceGap,
  };
  file.rules.push(rule);
  await writeRulesFile(file);
  return rule;
}

export function generatePatternForGap(gap: { system: string; description: string }): string {
  const slug = gap.description.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48);
  return `${gap.system}:${slug}`;
}

export async function _resetRedTeamRulesForTests(): Promise<void> {
  try {
    await fs.rm(redTeamRoot(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

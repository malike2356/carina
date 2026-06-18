import fs from 'node:fs';
import path from 'node:path';
import { CARINA_HOME } from '../config/paths.js';
import { config } from '../config/index.js';

export type SecurityAdvisory = {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  summary: string;
  component?: string;
  fixedIn?: string;
  url?: string;
  publishedAt?: string;
};

const BUILTIN: SecurityAdvisory[] = [
  {
    id: 'CARINA-2026-001',
    severity: 'high',
    title: 'Rotate exposed API keys immediately',
    summary: 'If an operator API key or provider secret appears in chat logs or tool output, rotate it and review security audit events.',
    component: 'credentials',
    fixedIn: 'Use CARINA_WEB_PASSWORD, redaction middleware, and carina secrets audit.',
    url: `${config.product.docsUrl}/security`,
  },
  {
    id: 'CARINA-2026-002',
    severity: 'medium',
    title: 'Enable approval policy on production hosts',
    summary: 'Dangerous tools should run behind CARINA_APPROVAL_POLICY and allowlist-first defaults when LABYRINTH is enabled.',
    component: 'tool-policy',
    fixedIn: 'Set CARINA_APPROVAL_POLICY=on and review carina security doctor.',
  },
  {
    id: 'CARINA-2026-003',
    severity: 'medium',
    title: 'Review third-party skill packs before enable',
    summary: 'Community skills may include shell or network actions. Run carina skills validate and review workshop queue before promotion.',
    component: 'skills',
    fixedIn: 'Use CARINA_SKILL_WORKSHOP=true and scanSkillSecurity before install.',
  },
];

function cachePath(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'data', 'security-advisories.json');
}

function readCache(homeDir = CARINA_HOME): SecurityAdvisory[] {
  const file = cachePath(homeDir);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { advisories?: SecurityAdvisory[] };
    return Array.isArray(parsed.advisories) ? parsed.advisories : [];
  } catch {
    return [];
  }
}

export function listSecurityAdvisories(homeDir = CARINA_HOME): SecurityAdvisory[] {
  const cached = readCache(homeDir);
  const byId = new Map<string, SecurityAdvisory>();
  for (const item of [...BUILTIN, ...cached]) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return rank[a.severity] - rank[b.severity];
  });
}

export async function refreshSecurityAdvisoriesFeed(homeDir = CARINA_HOME): Promise<{
  fetched: number;
  source: 'cache' | 'remote' | 'builtin';
}> {
  const url = process.env.CARINA_SECURITY_ADVISORIES_URL?.trim();
  if (!url) {
    return { fetched: listSecurityAdvisories(homeDir).length, source: 'builtin' };
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json() as { advisories?: SecurityAdvisory[] } | SecurityAdvisory[];
    const advisories = Array.isArray(body) ? body : body.advisories ?? [];
    const dir = path.dirname(cachePath(homeDir));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cachePath(homeDir), JSON.stringify({ updatedAt: new Date().toISOString(), advisories }, null, 2));
    return { fetched: advisories.length, source: 'remote' };
  } catch {
    return { fetched: listSecurityAdvisories(homeDir).length, source: 'cache' };
  }
}

export function advisoriesFeedEnabled(): boolean {
  return process.env.CARINA_SECURITY_ADVISORIES !== 'false';
}

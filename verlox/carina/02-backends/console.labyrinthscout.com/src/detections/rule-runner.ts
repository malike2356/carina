import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DetectionHit = {
  ruleId: string;
  title: string;
  severity: string;
  eventType: string;
};

type RuleWhen = {
  'payload.status'?: string[];
  'payload.cmd_contains'?: string[];
  'payload.remote_port_in'?: number[];
  'payload.remote_port_gte'?: number;
  'payload.remote_is_ip'?: boolean;
  'payload.path_prefix'?: string[];
  'payload.risk_tags'?: string[];
};

type Rule = {
  id: string;
  title: string;
  event_type: string;
  severity: string;
  when: RuleWhen;
};

type Pack = {
  pack_id: string;
  version: string;
  rules: Rule[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadEndpointPack(): Pack {
  const path = join(__dirname, 'packs/endpoint-v1/pack.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Pack;
}

function matchRule(rule: Rule, eventType: string, payload: Record<string, unknown>): boolean {
  if (rule.event_type !== eventType) return false;
  const w = rule.when;

  if (w['payload.status']) {
    const status = String(payload.status ?? '');
    if (!w['payload.status'].includes(status)) return false;
  }

  if (w['payload.cmd_contains']) {
    const cmd = String(payload.cmd ?? payload.command ?? '');
    if (!w['payload.cmd_contains'].some((s) => cmd.includes(s))) return false;
  }

  if (w['payload.remote_port_in']) {
    const port = Number(payload.remote_port ?? payload.remotePort ?? NaN);
    if (!w['payload.remote_port_in'].includes(port)) return false;
  }

  if (typeof w['payload.remote_port_gte'] === 'number') {
    const port = Number(payload.remote_port ?? payload.remotePort ?? NaN);
    if (!(port >= w['payload.remote_port_gte'])) return false;
  }

  if (w['payload.remote_is_ip'] === true) {
    const host = String(payload.remote_host ?? payload.remoteHost ?? '');
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  }

  if (w['payload.path_prefix']) {
    const path = String(payload.path ?? '');
    if (!w['payload.path_prefix'].some((p) => path === p || path.startsWith(`${p}`))) return false;
  }

  if (w['payload.risk_tags']) {
    const tags = Array.isArray(payload.risk_tags) ? payload.risk_tags.map(String) : [];
    if (!w['payload.risk_tags'].some((t) => tags.includes(t))) return false;
  }

  return Object.keys(w).length > 0;
}

export function runDetectionsOnEvent(
  eventType: string,
  payload: Record<string, unknown>,
  pack: Pack = loadEndpointPack(),
): DetectionHit[] {
  const hits: DetectionHit[] = [];
  for (const rule of pack.rules) {
    if (matchRule(rule, eventType, payload)) {
      hits.push({
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        eventType: rule.event_type,
      });
    }
  }
  return hits;
}

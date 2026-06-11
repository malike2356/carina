import type { Tool } from '../types/index.js';
import { registry } from './registry.js';
import {
  LEAK_PRONE_TOOL_NAMES,
  lookupToolRisk,
  TOOL_RISK_REGISTRY,
  type ToolRiskClass,
  type ToolRiskSpec,
} from './tool-risk-registry.js';

export type { ToolRiskClass } from './tool-risk-registry.js';

export interface ToolRiskEntry {
  name: string;
  riskClass: ToolRiskClass;
  dangerous: boolean;
  requiresConfirmation: boolean;
  sideEffects: string[];
  registered: boolean;
}

function entryFromSpec(name: string, tool: Tool | undefined, spec: ToolRiskSpec): ToolRiskEntry {
  return {
    name,
    riskClass: spec.riskClass,
    dangerous: Boolean(tool?.dangerous),
    requiresConfirmation: Boolean(tool?.requiresConfirmation),
    sideEffects: [...spec.sideEffects],
    registered: Boolean(tool),
  };
}

export function buildToolInventory(): ToolRiskEntry[] {
  const tools = new Map(registry.list().map((t) => [t.name, t]));
  const names = new Set([...Object.keys(TOOL_RISK_REGISTRY), ...tools.keys()]);
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const tool = tools.get(name);
      const spec = lookupToolRisk(name);
      if (!spec) {
        return {
          name,
          riskClass: 'read' as ToolRiskClass,
          dangerous: Boolean(tool?.dangerous),
          requiresConfirmation: Boolean(tool?.requiresConfirmation),
          sideEffects: ['unclassified tool'],
          registered: Boolean(tool),
        };
      }
      return entryFromSpec(name, tool, spec);
    });
}

export function findUnregisteredTools(): string[] {
  const registered = new Set(registry.list().map((t) => t.name));
  return [...registered].filter((name) => !lookupToolRisk(name)).sort();
}

export function findMissingRegistryEntries(): string[] {
  const registered = new Set(registry.list().map((t) => t.name));
  return Object.keys(TOOL_RISK_REGISTRY).filter((name) => !registered.has(name)).sort();
}

export function auditToolInventory(): {
  total: number;
  registered: number;
  byRisk: Record<ToolRiskClass, number>;
  missingDangerousFlag: string[];
  unclassified: string[];
  highRiskTools: ToolRiskEntry[];
} {
  const entries = buildToolInventory().filter((e) => e.registered);
  const byRisk: Record<ToolRiskClass, number> = {
    read: 0,
    write: 0,
    execute: 0,
    external: 0,
    credential: 0,
  };
  const missingDangerousFlag: string[] = [];
  const unclassified: string[] = [];
  const highRiskTools: ToolRiskEntry[] = [];

  for (const entry of entries) {
    byRisk[entry.riskClass]++;
    const spec = lookupToolRisk(entry.name);
    if (!spec) {
      unclassified.push(entry.name);
      continue;
    }
    if (spec.requiresDangerousFlag && !entry.dangerous) {
      missingDangerousFlag.push(entry.name);
    }
    if (['write', 'execute', 'credential'].includes(entry.riskClass)) {
      highRiskTools.push(entry);
    }
  }

  return {
    total: buildToolInventory().length,
    registered: entries.length,
    byRisk,
    missingDangerousFlag,
    unclassified,
    highRiskTools,
  };
}

export { LEAK_PRONE_TOOL_NAMES, TOOL_RISK_REGISTRY };

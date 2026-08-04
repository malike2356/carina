import { describe, it, expect } from 'vitest';
import './index.js';
import {
  auditToolInventory,
  buildToolInventory,
  findUnregisteredTools,
} from './tool-inventory.js';
import { LEAST_PRIVILEGE_TOOLSETS } from './toolset-config.js';
import { resolveToolset } from './toolset.js';
import { LEAK_PRONE_TOOL_NAMES } from './tool-risk-registry.js';

describe('tool policy matrix', () => {
  it('indexes every registered tool by risk class', () => {
    const entries = buildToolInventory().filter((e) => e.registered);
    expect(entries.length).toBeGreaterThan(50);
    for (const entry of entries) {
      expect(['read', 'write', 'execute', 'external', 'credential']).toContain(entry.riskClass);
    }
  });

  it('has no unregistered tools in the risk registry', () => {
    expect(findUnregisteredTools()).toEqual([]);
  });

  it('classifies leak-prone tools as high risk', () => {
    const byName = new Map(buildToolInventory().map((e) => [e.name, e]));
    const registeredLeakProne = LEAK_PRONE_TOOL_NAMES.filter((name) => byName.get(name)?.registered);
    expect(registeredLeakProne.length).toBeGreaterThan(5);
    for (const name of registeredLeakProne) {
      const entry = byName.get(name);
      expect(entry, `missing ${name}`).toBeDefined();
      expect(['write', 'execute', 'credential', 'external']).toContain(entry!.riskClass);
      expect(entry!.dangerous).toBe(true);
    }
  });

  it('keeps least-privilege default free of shell and browser tools', () => {
    const allowed = new Set(resolveToolset([...LEAST_PRIVILEGE_TOOLSETS]));
    expect(allowed.has('shell-exec')).toBe(false);
    expect(allowed.has('browser-navigate')).toBe(false);
    expect(allowed.has('email-send')).toBe(false);
    expect(allowed.has('web-search')).toBe(true);
    expect(allowed.has('file-read')).toBe(true);
  });

  it('reports audit summary with high-risk inventory', () => {
    const report = auditToolInventory();
    expect(report.highRiskTools.length).toBeGreaterThan(10);
    expect(report.byRisk.execute).toBeGreaterThan(0);
    expect(report.missingDangerousFlag).toEqual([]);
    expect(report.unclassified).toEqual([]);
  });
});

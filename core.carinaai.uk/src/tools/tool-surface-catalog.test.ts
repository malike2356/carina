import { describe, it, expect } from 'vitest';
import './index.js';
import {
  buildToolSurfaceCatalog,
  findCatalogGaps,
  summarizeToolCatalog,
} from './tool-surface-catalog.js';
import { findUnregisteredTools } from './tool-inventory.js';
import { TOOLSET_MAP } from './toolset.js';

describe('tool surface catalog', () => {
  it('covers every registered tool with catalog metadata', () => {
    const gaps = findCatalogGaps();
    expect(
      gaps.registeredWithoutMeta,
      `add TOOL_META entries: ${gaps.registeredWithoutMeta.join(', ')}`,
    ).toEqual([]);
  });

  it('maps every toolset tool to a registered runtime tool or optional browser/pack tool', () => {
    const catalog = new Map(buildToolSurfaceCatalog().map((e) => [e.name, e]));
    const missing: string[] = [];
    for (const tool of [...new Set(Object.values(TOOLSET_MAP).flat())]) {
      const entry = catalog.get(tool);
      if (!entry?.registered && !entry?.optional) {
        missing.push(tool);
      }
    }
    expect(missing, `missing registrations: ${missing.join(', ')}`).toEqual([]);
  });

  it('reports a non-zero registered tool count', () => {
    const summary = summarizeToolCatalog();
    expect(summary.registered).toBeGreaterThanOrEqual(99);
    expect(findUnregisteredTools()).toEqual([]);
  });

  it('includes new workspace and ops tools', () => {
    const names = new Set(buildToolSurfaceCatalog().map((e) => e.name));
    expect(names.has('notes-manage')).toBe(true);
    expect(names.has('documents-manage')).toBe(true);
    expect(names.has('images-gallery')).toBe(true);
    expect(names.has('secrets-audit')).toBe(true);
    expect(names.has('capabilities-audit')).toBe(true);
    expect(names.has('json-format')).toBe(true);
  });
});

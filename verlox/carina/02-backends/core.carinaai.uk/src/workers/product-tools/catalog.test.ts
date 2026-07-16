import { describe, expect, it } from 'vitest';
import { loadProductToolsCatalog, getCatalogTool, listPublicProductTools } from './catalog.js';
import { loadDepthFeatures } from './features.js';

describe('aiva product tools catalog (config-driven)', () => {
  it('loads at least 35 tools from JSON catalog', () => {
    const catalog = loadProductToolsCatalog(true);
    expect(catalog.tools.length).toBeGreaterThanOrEqual(35);
    expect(getCatalogTool('gmail')?.driver).toBe('google');
    expect(getCatalogTool('browser')?.driver).toBe('browser');
    expect(getCatalogTool('custom-http')?.auth).toBe('vault');
  });

  it('exposes public tools without throwing', () => {
    const tools = listPublicProductTools();
    expect(tools.some((tool) => tool.slug === 'hubspot')).toBe(true);
  });
});

describe('aiva depth features (config-driven)', () => {
  it('loads voice and skills toggles', () => {
    const features = loadDepthFeatures(true);
    expect(['ptt', 'duplex']).toContain(features.voice.mode);
    expect(typeof features.skills.autoPropose).toBe('boolean');
    expect(typeof features.orgs.canvasEnabled).toBe('boolean');
    expect(typeof features.search.messageBody).toBe('boolean');
  });
});

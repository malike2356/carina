import { describe, expect, it } from 'vitest';
import {
  isLegacyPlatformProductName,
  resolveAgentDisplayName,
  stripPlatformEquivalentBrand,
} from './brand-compat';
import { resolveWorkspaceBrand } from './brand';

describe('brand-compat', () => {
  it('recognises legacy platform labels', () => {
    expect(isLegacyPlatformProductName('Carina Cloud', 'hosted')).toBe(true);
    expect(isLegacyPlatformProductName('Acme Cloud', 'hosted')).toBe(false);
  });

  it('strips platform-equivalent workspace brand before resolve', () => {
    const stripped = stripPlatformEquivalentBrand(
      { productName: 'Carina Cloud', supportEmail: 'help@client.example' },
      'hosted',
    );
    const resolved = resolveWorkspaceBrand({ workspaceBrand: stripped });
    expect(resolved.productName).toBe('Carina Cloud');
    expect(resolved.supportEmail).toBe('help@client.example');
  });

  it('keeps ordinary Carina install defaults when brand JSON is empty', () => {
    const resolved = resolveWorkspaceBrand({ workspaceBrand: {} });
    expect(resolved.productName).toBe('Carina Cloud');
  });

  it('uses customer short name for agent-facing copy', () => {
    expect(resolveAgentDisplayName('Nova Cloud', 'Nova')).toBe('Nova');
    expect(resolveAgentDisplayName('Carina Cloud', 'Carina')).toBe('Carina');
    expect(resolveAgentDisplayName()).toBe('Carina');
  });
});

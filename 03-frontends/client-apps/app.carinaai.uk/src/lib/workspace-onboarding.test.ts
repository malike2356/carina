import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceOnboardingChecklist,
  isBrandConfigured,
  parseActivePackCount,
} from './workspace-onboarding';

describe('workspace-onboarding', () => {
  it('detects configured brand fields', () => {
    expect(isBrandConfigured({})).toBe(false);
    expect(isBrandConfigured({ productName: 'Nova Agents' }, 'Carina Cloud')).toBe(true);
    expect(isBrandConfigured({ supportEmail: 'help@client.example' })).toBe(true);
  });

  it('builds checklist progress from workspace signals', () => {
    const checklist = buildWorkspaceOnboardingChecklist({
      keyCount: 1,
      brand: { productName: 'Acme Agents' },
      activePackCount: 2,
      productName: 'Acme Cloud',
    });
    expect(checklist.completedCount).toBe(4);
    expect(checklist.percentComplete).toBe(100);
    expect(checklist.steps.find((step) => step.id === 'keys')?.done).toBe(true);
    expect(checklist.steps.find((step) => step.id === 'packs')?.done).toBe(true);
  });

  it('parses active pack count', () => {
    expect(parseActivePackCount('finance, healthcare')).toBe(2);
  });
});

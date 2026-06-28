import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Worker } from '../types/index.js';

const mockGetPortfolio = vi.fn();
const mockGetEmailActivity = vi.fn();

vi.mock('../bridges/propreneur-bridge.js', () => ({
  formatPortfolioContext: (portfolio: { total: number; properties: Array<{ label: string }> }) =>
    portfolio.total === 0
      ? 'Propreneur portfolio: no properties on file.'
      : `Propreneur portfolio (${portfolio.total} properties):\n- ${portfolio.properties[0]?.label}`,
  getPortfolio: (...args: unknown[]) => mockGetPortfolio(...args),
  getEmailActivity: (...args: unknown[]) => mockGetEmailActivity(...args),
}));

vi.mock('./aiva-feature-flags.js', () => ({
  isPropreneurBridgeEnabled: () => true,
}));

vi.mock('./worker-bridge-store.js', () => ({
  resolvePropreneurBinding: () => ({ tenantSlug: 'xelox', apiKey: 'test-key' }),
}));

describe('portfolio-context', () => {
  beforeEach(() => {
    mockGetPortfolio.mockReset();
    mockGetEmailActivity.mockReset();
    mockGetEmailActivity.mockResolvedValue({ total: 0 });
  });

  it('buildPortfolioContextBlock includes email activity when present', async () => {
    const { buildPortfolioContextBlock } = await import('./portfolio-context.js');
    const block = buildPortfolioContextBlock('Propreneur portfolio (2 properties):', 3);
    expect(block).toContain('Email activity (24h): 3');
    expect(block).toContain('propreneur portfolio tools');
  });

  it('buildPortfolioContextSuffix returns empty when bridge fetch fails', async () => {
    mockGetPortfolio.mockRejectedValue(new Error('bridge down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { buildPortfolioContextSuffix, clearPortfolioContextCache } = await import('./portfolio-context.js');
    clearPortfolioContextCache();
    const suffix = await buildPortfolioContextSuffix({ id: 'worker-fail' } as Worker);
    expect(suffix).toBe('');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('buildPortfolioContextSuffix caches successful fetch', async () => {
    mockGetPortfolio.mockResolvedValue({
      total: 1,
      properties: [{ id: 1, label: 'Flat 4', status: 'let' }],
    });
    mockGetEmailActivity.mockResolvedValue({ total: 2 });
    const { buildPortfolioContextSuffix, clearPortfolioContextCache } = await import('./portfolio-context.js');
    clearPortfolioContextCache('worker-cache-only');
    const worker = { id: 'worker-cache-only' } as Worker;
    const first = await buildPortfolioContextSuffix(worker);
    const second = await buildPortfolioContextSuffix(worker);
    expect(first).toContain('Flat 4');
    expect(second).toBe(first);
    expect(mockGetPortfolio).toHaveBeenCalledTimes(1);
  });
});

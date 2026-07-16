import { describe, expect, it } from 'vitest';
import { resolveHostBrandContext } from '@/lib/host-resolver';

describe('resolveHostBrandContext', () => {
  it('returns Aiva brand on the Aiva product host', async () => {
    const context = await resolveHostBrandContext('admin.hireaiva.co.uk');

    expect(context.isAivaProduct).toBe(true);
    expect(context.productSurface).toBe('aiva');
    expect(context.isCanonical).toBe(true);
    expect(context.canonicalHost).toBe('admin.hireaiva.co.uk');
    expect(context.resolvedBrand.productName).toBe('Aiva');
    expect(context.resolvedBrand.publicSiteTitle).toBe('Aiva');
    expect(context.resolvedBrand.supportName).toBe('Aiva Support');
  });

  it('returns cloud surface on the canonical app host', async () => {
    const context = await resolveHostBrandContext('app.carinaai.uk');

    expect(context.isAivaProduct).toBe(false);
    expect(context.productSurface).toBe('cloud');
    expect(context.resolvedBrand.productName).toBe('Carina Cloud');
  });
});

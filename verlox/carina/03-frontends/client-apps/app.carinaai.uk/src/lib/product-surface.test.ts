import { describe, expect, it } from 'vitest';
import {
  filterNavForSurface,
  filterNavGroupsForSurface,
  NAV_GROUPS,
  NAV_ROUTES,
} from '@/lib/workspace-nav';
import {
  billingHrefForSurface,
  getProductSurface,
  isAivaProductHost,
  isCloudOnlyRoute,
} from '@/lib/product-surface';

describe('product-surface', () => {
  it('detects the Aiva product host', () => {
    expect(isAivaProductHost('admin.hireaiva.co.uk')).toBe(true);
    expect(isAivaProductHost('app.carinaai.uk')).toBe(false);
    expect(getProductSurface('admin.hireaiva.co.uk')).toBe('aiva');
  });

  it('supports multiple Aiva product hosts from env', () => {
    const prev = process.env.AIVA_PRODUCT_HOSTS;
    process.env.AIVA_PRODUCT_HOSTS = 'admin.hireaiva.co.uk,staging.admin.hireaiva.co.uk';
    expect(isAivaProductHost('admin.hireaiva.co.uk')).toBe(true);
    expect(isAivaProductHost('staging.admin.hireaiva.co.uk')).toBe(true);
    expect(isAivaProductHost('aiva.carinaai.uk')).toBe(false);
    process.env.AIVA_PRODUCT_HOSTS = prev;
  });

  it('flags cloud-only routes', () => {
    expect(isCloudOnlyRoute('/chat/abc')).toBe(true);
    expect(isCloudOnlyRoute('/aiva/workers')).toBe(false);
    expect(isCloudOnlyRoute('/billing')).toBe(false);
  });

  it('resolves billing href per product surface', () => {
    expect(billingHrefForSurface('aiva')).toBe('/billing/aiva');
    expect(billingHrefForSurface('cloud')).toBe('/billing');
  });

  it('filters nav to Aiva and account groups only', () => {
    const routes = filterNavForSurface('aiva', NAV_ROUTES);
    expect(routes.every((r) => r.group === 'aiva' || r.group === 'account')).toBe(true);
    expect(routes.some((r) => r.href === '/aiva/workers')).toBe(true);
    expect(routes.some((r) => r.href === '/billing/aiva')).toBe(true);
    expect(routes.some((r) => r.href === '/billing')).toBe(false);
    expect(routes.some((r) => r.href === '/chat')).toBe(false);
    expect(routes.some((r) => r.href === '/logs')).toBe(false);
    expect(routes.some((r) => r.href === '/profiles')).toBe(false);

    const groups = filterNavGroupsForSurface('aiva', NAV_GROUPS);
    expect(groups.map((g) => g.id)).toEqual(['aiva', 'account']);
  });
});

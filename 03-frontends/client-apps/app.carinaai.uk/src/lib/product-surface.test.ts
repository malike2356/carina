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
    expect(isCloudOnlyRoute('/chat/abc')).toBe(false);
    expect(isCloudOnlyRoute('/chat')).toBe(false);
    expect(isCloudOnlyRoute('/launcher')).toBe(true);
    expect(isCloudOnlyRoute('/dashboard')).toBe(true);
    expect(isCloudOnlyRoute('/sessions')).toBe(true);
    expect(isCloudOnlyRoute('/skills')).toBe(true);
    expect(isCloudOnlyRoute('/models')).toBe(true);
    expect(isCloudOnlyRoute('/config')).toBe(true);
    expect(isCloudOnlyRoute('/aiva/workers')).toBe(false);
    expect(isCloudOnlyRoute('/billing')).toBe(false);
    // Aiva primary nav destinations must not bounce to /aiva/workers
    expect(isCloudOnlyRoute('/documents')).toBe(false);
    expect(isCloudOnlyRoute('/calendar')).toBe(false);
    expect(isCloudOnlyRoute('/tasks')).toBe(false);
    expect(isCloudOnlyRoute('/research')).toBe(false);
    expect(isCloudOnlyRoute('/outreach')).toBe(false);
    expect(isCloudOnlyRoute('/email')).toBe(false);
    expect(isCloudOnlyRoute('/files')).toBe(false);
    expect(isCloudOnlyRoute('/scheduled')).toBe(false);
    expect(isCloudOnlyRoute('/incident-blog')).toBe(false);
  });

  it('resolves billing href per product surface', () => {
    expect(billingHrefForSurface('aiva')).toBe('/billing/aiva');
    expect(billingHrefForSurface('cloud')).toBe('/billing');
  });

  it('filters nav to Aiva and account groups only', () => {
    expect(NAV_ROUTES.some((r) => r.href === '/dashboard')).toBe(true);
    expect(NAV_ROUTES.some((r) => r.href === '/sessions')).toBe(true);
    expect(NAV_ROUTES.some((r) => r.href === '/skills')).toBe(true);
    expect(NAV_ROUTES.some((r) => r.href === '/models')).toBe(true);
    expect(NAV_ROUTES.some((r) => r.href === '/config')).toBe(true);

    const routes = filterNavForSurface('aiva', NAV_ROUTES);
    expect(routes.every((r) => r.group === 'aiva' || r.group === 'account')).toBe(true);
    expect(routes.some((r) => r.href === '/aiva/workers')).toBe(true);
    expect(routes.some((r) => r.href === '/billing/aiva')).toBe(true);
    expect(routes.some((r) => r.href === '/incident-blog')).toBe(false);
    expect(routes.some((r) => r.href === '/dashboard')).toBe(false);
    expect(routes.some((r) => r.href === '/sessions')).toBe(false);
    expect(routes.some((r) => r.href === '/skills')).toBe(false);
    expect(routes.some((r) => r.href === '/models')).toBe(false);
    expect(routes.some((r) => r.href === '/config')).toBe(false);
    expect(routes.some((r) => r.href === '/billing')).toBe(false);
    expect(routes.some((r) => r.href === '/chat')).toBe(false);
    expect(routes.some((r) => r.href === '/logs')).toBe(false);
    expect(routes.some((r) => r.href === '/profiles')).toBe(false);

    const groups = filterNavGroupsForSurface('aiva', NAV_GROUPS);
    expect(groups.map((g) => g.id)).toEqual(['aiva', 'account']);
  });
});

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  classifyRoute,
  isRouteAllowedForMode,
  normalizeRoutePath,
  routeDenialForMode,
} from './route-matrix.js';
import { resolveProductMode, resolveProductSurface } from './surface.js';

describe('product surface', () => {
  const prevHosted = process.env.HOSTED_MODE;
  const prevHosts = process.env.CARINA_OPERATOR_HOSTS;
  const prevOverride = process.env.CARINA_PRODUCT_MODE;

  beforeEach(() => {
    process.env.HOSTED_MODE = 'true';
    process.env.CARINA_OPERATOR_HOSTS = 'core.carinaai.uk,localhost';
    delete process.env.CARINA_PRODUCT_MODE;
  });

  afterEach(() => {
    process.env.HOSTED_MODE = prevHosted;
    process.env.CARINA_OPERATOR_HOSTS = prevHosts;
    if (prevOverride === undefined) delete process.env.CARINA_PRODUCT_MODE;
    else process.env.CARINA_PRODUCT_MODE = prevOverride;
  });

  it('resolves hosted mode for app.carinaai.uk', () => {
    expect(resolveProductMode('app.carinaai.uk')).toBe('hosted');
    const surface = resolveProductSurface('app.carinaai.uk');
    expect(surface.branding.productName).toBe('Carina Cloud');
    expect(surface.branding.loginPath).toBe('/hosted-login');
  });

  it('resolves private mode for core.carinaai.uk', () => {
    expect(resolveProductMode('core.carinaai.uk')).toBe('private');
    const surface = resolveProductSurface('core.carinaai.uk');
    expect(surface.branding.productName).toBe('Carina');
    expect(surface.branding.loginPath).toBe('/login');
    expect(surface.shell.instanceNav.some((item) => item.id === 'control')).toBe(true);
  });

  it('honours CARINA_PRODUCT_MODE override', () => {
    process.env.CARINA_PRODUCT_MODE = 'hosted';
    expect(resolveProductMode('core.carinaai.uk')).toBe('hosted');
  });
});

describe('route matrix', () => {
  it('classifies hosted auth and billing routes', () => {
    expect(classifyRoute('/hosted-login')).toBe('hosted');
    expect(classifyRoute('/billing')).toBe('hosted');
    expect(classifyRoute('/ops/workbench')).toBe('hosted');
    expect(classifyRoute('/api/cloud/auth/login')).toBe('hosted');
  });

  it('classifies private control routes', () => {
    expect(classifyRoute('/login')).toBe('private');
    expect(classifyRoute('/control')).toBe('private');
    expect(classifyRoute('/kanban')).toBe('private');
    expect(classifyRoute('/email')).toBe('private');
    expect(classifyRoute('/prompt-packs')).toBe('private');
    expect(classifyRoute('/trello')).toBe('private');
  });

  it('classifies shared workspace routes', () => {
    expect(classifyRoute('/memory')).toBe('shared');
    expect(classifyRoute('/notes')).toBe('shared');
    expect(classifyRoute('/webhooks')).toBe('shared');
    expect(classifyRoute('/scheduled')).toBe('shared');
  });

  it('allows shared routes on both surfaces', () => {
    expect(isRouteAllowedForMode('hosted', '/memory')).toBe(true);
    expect(isRouteAllowedForMode('private', '/memory')).toBe(true);
    expect(isRouteAllowedForMode('hosted', '/scheduled')).toBe(true);
    expect(isRouteAllowedForMode('private', '/scheduled')).toBe(true);
  });

  it('denies hosted billing on private core', () => {
    expect(isRouteAllowedForMode('private', '/billing')).toBe(false);
    const denial = routeDenialForMode('private', '/billing');
    expect(denial?.redirect).toContain('app.carinaai.uk');
  });

  it('denies private control on hosted app', () => {
    expect(isRouteAllowedForMode('hosted', '/control')).toBe(false);
    expect(routeDenialForMode('hosted', '/control')?.status).toBe(404);
  });

  it('redirects hosted /login to hosted-login', () => {
    expect(routeDenialForMode('hosted', '/login')?.redirect).toBe('/hosted-login');
  });

  it('normalises trailing slashes', () => {
    expect(normalizeRoutePath('/notes/')).toBe('/notes');
    expect(normalizeRoutePath('/')).toBe('/');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveBrand } from './brand.js';
import {
  resolveAgentDisplayName,
  resolveBrandedProductSurface,
  stripPlatformEquivalentBrand,
} from './brand-compat.js';
import { isLegacyPlatformProductName } from './brand-glossary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../qa/demo-tenant-brand.json'), 'utf8'),
) as {
  reseller: { productName: string; supportEmail: string };
  tenants: Array<{
    id: string;
    workspace: { productName: string; shortName: string; supportEmail: string };
    customDomain: string;
  }>;
  platformDefaults: { hosted: { productName: string } };
  whiteLabelStack: string;
};

describe('white-label smoke', () => {
  it('keeps platform defaults for unconfigured hosted installs', () => {
    const prev = process.env.CARINA_PRODUCT_MODE;
    process.env.CARINA_PRODUCT_MODE = 'hosted';
    try {
      const surface = resolveBrandedProductSurface('app.carinaai.uk');
      expect(surface.branding.productName).toBe(demoFixture.platformDefaults.hosted.productName);
    } finally {
      if (prev === undefined) delete process.env.CARINA_PRODUCT_MODE;
      else process.env.CARINA_PRODUCT_MODE = prev;
    }
  });

  it('isolates demo tenant brands from each other and reseller defaults', () => {
    const [tenantA, tenantB] = demoFixture.tenants;
    const brandA = resolveBrand({
      mode: 'hosted',
      reseller: demoFixture.reseller,
      workspace: tenantA.workspace,
    });
    const brandB = resolveBrand({
      mode: 'hosted',
      reseller: demoFixture.reseller,
      workspace: tenantB.workspace,
    });

    expect(brandA.productName).toBe('Acme Agents');
    expect(brandB.productName).toBe('Nova Workspace');
    expect(brandA.productName).not.toBe(brandB.productName);
    expect(brandA.supportEmail).toBe('help@acme.example');
    expect(brandB.supportEmail).toBe('help@nova.example');
    expect(resolveAgentDisplayName(brandA)).toBe('Acme');
    expect(resolveAgentDisplayName(brandB)).toBe('Nova');
  });

  it('does not treat legacy platform labels as customer brand overrides', () => {
    for (const tenant of demoFixture.tenants) {
      const stripped = stripPlatformEquivalentBrand(
        { ...tenant.workspace, productName: 'Carina Cloud' },
        'hosted',
      );
      const brand = resolveBrand({ mode: 'hosted', workspace: stripped });
      expect(brand.productName).toBe('Carina Cloud');
      expect(isLegacyPlatformProductName('Carina Cloud', 'hosted')).toBe(true);
    }
  });

  it('applies customer hostname branding without leaking platform workspace name', () => {
    const tenant = demoFixture.tenants[0];
    const surface = resolveBrandedProductSurface(tenant.customDomain, {
      workspace: tenant.workspace,
    });
    expect(surface.branding.productName).toBe('Acme Agents');
    expect(surface.branding.workspaceName).toBe('Acme Agents');
    expect(surface.branding.productName).not.toBe('Carina Cloud');
  });

  it('loads demo tenant fixture for stack smoke metadata', () => {
    expect(demoFixture.whiteLabelStack).toBe('demo-agents');
    expect(demoFixture.tenants).toHaveLength(2);
  });
});

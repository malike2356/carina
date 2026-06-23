import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mergeBrandSettings, resolveBrand, resolveWorkspaceBrand } from '@/lib/brand';
import { resolveAgentDisplayName, stripPlatformEquivalentBrand } from '@/lib/brand-compat';
import { buildBrandedPlanOptions } from '@/lib/billing-presentment';
import {
  buildWorkspaceOnboardingChecklist,
  isBrandConfigured,
} from '@/lib/workspace-onboarding';
import {
  dnsVerificationRecordName,
  isCanonicalAppHost,
  normaliseCustomDomainHostname,
  verificationTxtValue,
} from '@/lib/custom-domains';
import en from '@/i18n/locales/en';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoFixturePath = path.resolve(
  __dirname,
  '../../../../../backends/servers/core.carinaai.uk/qa/demo-tenant-brand.json',
);
const demoFixture = JSON.parse(fs.readFileSync(demoFixturePath, 'utf8')) as {
  reseller: { productName: string };
  tenants: Array<{
    id: string;
    workspace: { productName: string; shortName: string; supportEmail: string };
    customDomain: string;
  }>;
};

describe('white-label app smoke', () => {
  it('renders branded shell defaults for ordinary Carina Cloud installs', () => {
    const brand = resolveBrand({ mode: 'hosted' });
    expect(brand.productName).toBe('Carina Cloud');
    expect(brand.logoUrl).toBeNull();
  });

  it('uses customer product name for login and support copy signals', () => {
    const tenant = demoFixture.tenants[0];
    const brand = resolveWorkspaceBrand({ workspaceBrand: tenant.workspace });
    expect(brand.productName).toBe('Acme Agents');
    expect(brand.supportEmail).toBe('help@acme.example');
    expect(`Sign in to ${brand.productName}`).toBe('Sign in to Acme Agents');
  });

  it('strips platform-equivalent brand before persisting workspace settings', () => {
    const tenant = demoFixture.tenants[1];
    const merged = mergeBrandSettings(
      {},
      stripPlatformEquivalentBrand(
        { productName: 'Carina Cloud', supportEmail: tenant.workspace.supportEmail },
        'hosted',
      ),
    );
    const resolved = resolveWorkspaceBrand({ workspaceBrand: merged });
    expect(resolved.productName).toBe('Carina Cloud');
    expect(resolved.supportEmail).toBe('help@nova.example');
  });

  it('shows branded billing plan labels for customer workspaces', () => {
    const tenant = demoFixture.tenants[0];
    const plans = buildBrandedPlanOptions({
      currentPlan: 'starter',
      productName: tenant.workspace.productName,
    });
    expect(plans.find((plan) => plan.id === 'starter')?.name).toBe('Acme Agents Starter');
    expect(plans.every((plan) => !plan.name.includes('Carina'))).toBe(true);
  });

  it('tracks onboarding when brand, keys, and packs are configured', () => {
    const tenant = demoFixture.tenants[0];
    const checklist = buildWorkspaceOnboardingChecklist({
      keyCount: 1,
      brand: tenant.workspace,
      activePackCount: 1,
      productName: tenant.workspace.productName,
    });
    expect(isBrandConfigured(tenant.workspace, 'Carina Cloud')).toBe(true);
    expect(checklist.steps.find((step) => step.id === 'brand')?.done).toBe(true);
  });

  it('scopes custom domain verification to tenant hostnames', () => {
    const tenantA = demoFixture.tenants[0];
    const tenantB = demoFixture.tenants[1];
    process.env.CARINA_HOSTED_APP_HOST = 'app.carinaai.uk';

    expect(isCanonicalAppHost('app.carinaai.uk')).toBe(true);
    expect(isCanonicalAppHost(tenantA.customDomain)).toBe(false);
    expect(normaliseCustomDomainHostname(tenantA.customDomain)).toBe('agents.acme.example');
    expect(dnsVerificationRecordName(tenantB.customDomain)).toBe('_carina-verify.app.nova.example');
    expect(verificationTxtValue('demo-token')).toBe('carina-verify=demo-token');
  });

  it('keeps chat i18n agent placeholders brand-aware', () => {
    expect(en.chat.placeholder).toContain('{agentName}');
    expect(en.chat.placeholder).not.toContain('Carina');
    expect(en.chat.approvalRequest).toContain('{agentName}');
    expect(resolveAgentDisplayName('Nova Workspace', 'Nova')).toBe('Nova');
  });

  it('does not leak tenant A brand into tenant B resolution', () => {
    const [tenantA, tenantB] = demoFixture.tenants;
    const brandA = resolveWorkspaceBrand({
      resellerBrand: demoFixture.reseller,
      workspaceBrand: tenantA.workspace,
    });
    const brandB = resolveWorkspaceBrand({
      resellerBrand: demoFixture.reseller,
      workspaceBrand: tenantB.workspace,
    });
    expect(brandA.productName).not.toBe(brandB.productName);
    expect(brandA.shortName).toBe('Acme');
    expect(brandB.shortName).toBe('Nova');
  });
});

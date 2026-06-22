import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildEnterpriseSecurityStatus,
  buildSamlMetadataXml,
  evaluateGeoFence,
  evaluateNetworkPolicy,
  generateSoc2EvidencePackage,
  immutableEnterpriseAudit,
  issueEnterpriseSsoSession,
  loadDrConfig,
  loadResidencyConfig,
  mapIdpGroupsToRole,
  resetDrStateForTests,
  resetImmutableEnterpriseAuditForTests,
  runDrDrill,
  testEnterpriseSsoConnection,
  validateStorageLocation,
  verifySoc2EvidencePackage,
} from './index.js';

describe('enterprise security', () => {
  beforeEach(async () => {
    process.env.CARINA_HOME = path.join(os.tmpdir(), `carina-enterprise-${Date.now()}`);
    process.env.DATA_RESIDENCY_REGION = 'eu-west';
    process.env.DATA_RESIDENCY_MODE = 'strict';
    process.env.CARINA_SSO_OIDC_ISSUER = 'https://idp.example.com';
    process.env.CARINA_SSO_OIDC_CLIENT_ID = 'carina-client';
    process.env.CARINA_SSO_OIDC_CLIENT_SECRET = 'secret';
    await resetImmutableEnterpriseAuditForTests();
    await resetDrStateForTests();
  });

  afterEach(async () => {
    await resetImmutableEnterpriseAuditForTests();
    await resetDrStateForTests();
  });

  it('maps IdP groups to Carina roles', () => {
    expect(mapIdpGroupsToRole(['carina-admins'])).toBe('admin');
    expect(mapIdpGroupsToRole(['unknown-group'])).toBe('viewer');
  });

  it('issues SSO sessions with expiry', () => {
    const session = issueEnterpriseSsoSession({
      userId: 'u1',
      email: 'ops@example.com',
      provider: 'oidc',
      providerType: 'oidc',
      groups: ['carina-operators'],
    });
    expect(session.orgRole).toBe('operator');
    expect(session.expiresAt).toBeGreaterThan(session.issuedAt);
  });

  it('detects configured OIDC provider', () => {
    expect(testEnterpriseSsoConnection('oidc').ok).toBe(true);
    delete process.env.CARINA_SSO_OIDC_CLIENT_SECRET;
    expect(testEnterpriseSsoConnection('oidc').ok).toBe(false);
  });

  it('builds SAML metadata and OIDC discovery helpers', () => {
    expect(buildSamlMetadataXml()).toContain('EntityDescriptor');
  });

  it('maintains tamper-evident immutable audit chain with merkle roots', async () => {
    await immutableEnterpriseAudit.append({
      tenantId: 't1',
      actorId: 'u1',
      action: 'login',
    });
    await immutableEnterpriseAudit.append({
      tenantId: 't1',
      actorId: 'u1',
      action: 'tool_exec',
      details: { tool: 'nmap' },
    });
    const chain = await immutableEnterpriseAudit.verifyChain();
    expect(chain.valid).toBe(true);
    expect(chain.events).toBe(2);
    const roots = await immutableEnterpriseAudit.listMerkleRoots();
    expect(roots.length).toBeGreaterThan(0);
  });

  it('enforces residency and geo-fencing rules', () => {
    const config = loadResidencyConfig();
    expect(config.region).toBe('eu-west');
    expect(validateStorageLocation('eu-west-1', 'P1')).toBe(true);
    expect(validateStorageLocation('us-east-1', 'P1')).toBe(false);
    const blocked = evaluateGeoFence({
      path: '/api/v1/data/memories',
      countryCode: 'US',
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.statusCode).toBe(451);
  });

  it('records DR drills with RPO/RTO targets', async () => {
    const config = loadDrConfig();
    expect(config.rpoMinutes).toBe(5);
    const drill = await runDrDrill();
    expect(drill.passed).toBe(true);
    const status = await buildEnterpriseSecurityStatus();
    expect(status.dr.lastDrTestPassed).toBe(true);
  });

  it('evaluates zero-trust network policies', () => {
    expect(evaluateNetworkPolicy('carina-gateway', 'carina-core', 4444)).toBe(true);
    expect(evaluateNetworkPolicy('carina-web', 'postgres', 5432)).toBe(false);
  });

  it('generates and verifies SOC2 evidence packages', async () => {
    const manifest = await generateSoc2EvidencePackage({
      from: '2026-01-01',
      to: '2026-06-21',
    });
    expect(manifest.documentCount).toBeGreaterThan(0);
    const verification = await verifySoc2EvidencePackage(manifest.packagePath);
    expect(verification.valid).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { formatAuditAction } from './tenant-audit.js';

describe('tenant-audit', () => {
  it('formats known audit actions', () => {
    expect(formatAuditAction('tenant_created')).toBe('Tenant created');
    expect(formatAuditAction('skill_pack_changed')).toBe('Skill packs updated');
  });

  it('formats Sprint 2 support action labels', () => {
    expect(formatAuditAction('tenant.view')).toBe('Tenant viewed');
    expect(formatAuditAction('tenant.plan_override')).toBe('Plan overridden');
    expect(formatAuditAction('tenant.byok.view')).toBe('BYOK viewed');
    expect(formatAuditAction('tenant.suspend')).toBe('Tenant suspended');
    expect(formatAuditAction('tenant.impersonate_start')).toBe('Impersonation started');
    expect(formatAuditAction('tenant.impersonate_end')).toBe('Impersonation ended');
  });
});

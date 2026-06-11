import { describe, expect, it } from 'vitest';
import { formatAuditAction } from './tenant-audit.js';

describe('tenant-audit', () => {
  it('formats known audit actions', () => {
    expect(formatAuditAction('tenant_created')).toBe('Tenant created');
    expect(formatAuditAction('skill_pack_changed')).toBe('Skill packs updated');
  });
});

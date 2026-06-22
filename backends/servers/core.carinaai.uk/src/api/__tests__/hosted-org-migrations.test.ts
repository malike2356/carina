import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runHostedMigrations } from '../hosted-migrations.js';

describe('hosted org migrations', () => {
  const executed: string[] = [];

  beforeEach(() => {
    executed.length = 0;
  });

  it('runHostedMigrations creates organization tables', async () => {
    const mockQuery = vi.fn(async (sql: string) => {
      executed.push(sql);
      return { rows: [], rowCount: 0 };
    });
    const client = { query: mockQuery, release: vi.fn() };

    await runHostedMigrations(client as never);

    const combined = executed.join('\n');
    expect(combined).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(combined).toContain('CREATE TABLE IF NOT EXISTS org_memberships');
    expect(combined).toContain('CREATE TABLE IF NOT EXISTS org_invites');
    expect(combined).toContain('carina_ops_starter');
    expect(combined).toContain('org_id UUID REFERENCES organizations(id)');
    expect(combined).toContain('CREATE TABLE IF NOT EXISTS partner_accounts');
    expect(combined).toContain('CREATE TABLE IF NOT EXISTS custom_domains');
    expect(combined).toContain('organizations ADD COLUMN IF NOT EXISTS brand JSONB');
  });
});

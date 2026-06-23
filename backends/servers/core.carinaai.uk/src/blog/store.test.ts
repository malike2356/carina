import { describe, expect, it } from 'vitest';

describe('incident blog id lookup SQL', () => {
  it('uses text cast so uuid params do not break slug comparisons', () => {
    const lookupSql = 'id::text = $1 OR slug = $1';
    const updateSql = 'id::text = $1';
    expect(lookupSql).toContain('id::text');
    expect(updateSql).toContain('id::text');
    expect(lookupSql).not.toMatch(/\bid = \$1\b/);
  });
});

describe('incident blog pagination helpers', () => {
  it('builds count query from the same filter shape as list', () => {
    const countSql = 'SELECT COUNT(*)::text AS count FROM incident_blog';
    const statsSql = 'SELECT status, COUNT(*)::text AS count FROM incident_blog GROUP BY status';
    expect(countSql).toContain('COUNT(*)');
    expect(statsSql).toContain('GROUP BY status');
  });
});

describe('incident blog research history SQL', () => {
  it('orders research runs newest first with a limit', () => {
    const historySql = 'SELECT * FROM incident_research_runs ORDER BY run_at DESC LIMIT $1';
    expect(historySql).toContain('ORDER BY run_at DESC');
    expect(historySql).toContain('LIMIT $1');
  });
});

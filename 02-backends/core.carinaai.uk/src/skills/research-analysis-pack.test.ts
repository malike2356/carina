import { describe, expect, it } from 'vitest';
import { resolvePack } from './pack-resolver.js';

describe('research-analysis pack', () => {
  it('loads five skills from the extracted pack directory', async () => {
    const pack = await resolvePack('research-analysis');
    expect(pack.skills).toHaveLength(5);
    expect(pack.skills.map((skill) => skill.name)).toEqual([
      'research-data-explore',
      'research-group-comparison',
      'research-relationships',
      'research-spss-workflow',
      'research-jamovi-analysis',
    ]);
  });
});

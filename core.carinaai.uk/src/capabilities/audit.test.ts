import { describe, expect, it } from 'vitest';
import '../tools/index.js';
import { buildCapabilityAudit, CAPABILITY_TARGETS } from './audit.js';
import { warmPackSkillIndex } from '../skills/pack-resolver.js';

describe('capability audit', () => {
  it('meets operator targets for tools, skills, and channels', async () => {
    await warmPackSkillIndex();
    const audit = await buildCapabilityAudit();
    expect(audit.tools.registered).toBeGreaterThanOrEqual(CAPABILITY_TARGETS.tools);
    expect(audit.skills.builtin).toBeGreaterThanOrEqual(CAPABILITY_TARGETS.skills);
    expect(audit.channels.total).toBeGreaterThanOrEqual(CAPABILITY_TARGETS.channels);
    expect(audit.health.toolCatalogComplete).toBe(true);
    expect(audit.health.skillsIndexed).toBe(true);
    expect(audit.health.channelDiscoveryReady).toBe(true);
  });
});

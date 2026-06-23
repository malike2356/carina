import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createAgentDefinition,
  ensureAgentsConfig,
  getAgentDefinition,
  listAgentDefinitions,
} from './agent-registry.js';

const homes: string[] = [];

afterEach(async () => {
  for (const home of homes.splice(0)) {
    await fs.rm(home, { recursive: true, force: true });
  }
});

describe('agent-registry', () => {
  it('creates default main agent on first load', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-agents-'));
    homes.push(home);
    const config = await ensureAgentsConfig(home);
    expect(config.agents.some((a) => a.id === 'main')).toBe(true);
    const listed = listAgentDefinitions(home);
    expect(listed.length).toBeGreaterThan(0);
  });

  it('creates additional isolated agents', async () => {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-agents-'));
    homes.push(home);
    await ensureAgentsConfig(home);
    const agent = await createAgentDefinition({ id: 'coding', name: 'Coding' }, home);
    expect(agent.id).toBe('coding');
    expect(getAgentDefinition('coding', home)?.workspace).toContain('workspaces/coding');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildChildSpawnContext,
  buildLeafRolePrompt,
  buildOrchestratorRolePrompt,
  checkSpawnPermission,
  checkToolPermission,
} from './role-enforcer.js';
import type { AgentSpawnContext } from './agent-roles.js';

const leafContext: AgentSpawnContext = {
  depth: 2,
  parentAgentId: 'parent-1',
  role: 'leaf',
};

const orchestratorDepth0: AgentSpawnContext = {
  depth: 0,
  parentAgentId: null,
  role: 'orchestrator',
};

const orchestratorDepth2: AgentSpawnContext = {
  depth: 2,
  parentAgentId: 'parent-1',
  role: 'orchestrator',
};

describe('role-enforcer', () => {
  it('checkToolPermission(delegate-task, leaf) returns error string', () => {
    const err = checkToolPermission('delegate-task', leafContext);
    expect(err).toContain('leaf agents');
    expect(err).toContain('delegate-task');
  });

  it('checkToolPermission allows delegate-task for orchestrator', () => {
    expect(checkToolPermission('delegate-task', orchestratorDepth0)).toBeNull();
  });

  it('checkSpawnPermission at depth 2 returns error string', () => {
    const err = checkSpawnPermission(orchestratorDepth2, 0);
    expect(err).toContain('spawn depth');
    expect(err).toContain('2');
  });

  it('checkSpawnPermission blocks a 4th concurrent child', () => {
    const err = checkSpawnPermission(orchestratorDepth0, 3);
    expect(err).toContain('concurrent children');
    expect(err).toContain('3');
  });

  it('buildChildSpawnContext increments depth', () => {
    const child = buildChildSpawnContext(orchestratorDepth0, 'sess-1');
    expect(child.depth).toBe(1);
    expect(child.parentAgentId).toBe('sess-1');
    expect(child.role).toBe('orchestrator');
  });

  it('child at max depth gets role leaf', () => {
    const parent: AgentSpawnContext = { depth: 1, parentAgentId: 'root', role: 'orchestrator' };
    const child = buildChildSpawnContext(parent, 'root');
    expect(child.depth).toBe(2);
    expect(child.role).toBe('leaf');
  });

  it('role prompts mention leaf and orchestrator roles', () => {
    expect(buildLeafRolePrompt()).toContain('LEAF WORKER');
    expect(buildOrchestratorRolePrompt(0)).toContain('ORCHESTRATOR');
    expect(buildOrchestratorRolePrompt(1)).toContain('1/2');
  });
});

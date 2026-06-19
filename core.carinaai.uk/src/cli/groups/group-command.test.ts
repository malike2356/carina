import { describe, expect, it } from 'vitest';
import { expandCliArgv, resolveSubcommand } from '../group-command.js';
import { workspaceGroup } from './workspace.js';
import { COMMAND_GROUPS, resolveCommandGroup } from './index.js';

describe('expandCliArgv', () => {
  it('expands top-level and subcommand aliases', () => {
    expect(expandCliArgv(['ws', 'ls'])).toEqual(['workspace', 'list']);
    expect(expandCliArgv(['s', 'ls'])).toEqual(['session', 'list']);
    expect(expandCliArgv(['mem', 'ls'])).toEqual(['memory', 'list']);
    expect(expandCliArgv(['sk', 'ls'])).toEqual(['skill', 'list']);
    expect(expandCliArgv(['cfg', 'ls'])).toEqual(['config', 'list']);
  });

  it('leaves unknown commands unchanged', () => {
    expect(expandCliArgv(['chat'])).toEqual(['chat']);
    expect(expandCliArgv(['gateway', 'status'])).toEqual(['gateway', 'status']);
  });
});

describe('command groups', () => {
  it('registers 15 groups', () => {
    expect(COMMAND_GROUPS.length).toBe(15);
  });

  it('resolves workspace subcommands', () => {
    const group = resolveCommandGroup('ws');
    expect(group?.name).toBe('workspace');
    expect(resolveSubcommand(workspaceGroup, 'ls')?.name).toBe('list');
  });
});

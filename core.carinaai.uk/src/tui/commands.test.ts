import { describe, expect, it } from 'vitest';
import { parseInputLine, viewFromKey } from './commands.js';

describe('tui commands', () => {
  it('parses quit and refresh commands', () => {
    expect(parseInputLine(':q', 'sessions').type).toBe('quit');
    expect(parseInputLine(':refresh', 'tasks').type).toBe('refresh');
  });

  it('routes chat input on chat view', () => {
    const cmd = parseInputLine('hello world', 'chat');
    expect(cmd).toEqual({ type: 'chat', message: 'hello world' });
  });

  it('maps number keys to tabs', () => {
    expect(viewFromKey('2')).toEqual({ type: 'tab', view: 'tasks' });
  });

  it('parses task actions on tasks view', () => {
    expect(parseInputLine(':run', 'tasks').type).toBe('task_action');
    expect(parseInputLine(':pause', 'tasks')).toEqual({ type: 'task_action', action: 'pause' });
  });

  it('parses stop command', () => {
    expect(parseInputLine('/stop', 'chat').type).toBe('stop_turn');
  });
});

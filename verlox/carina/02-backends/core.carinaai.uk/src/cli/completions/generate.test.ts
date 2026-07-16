import { describe, expect, it } from 'vitest';
import { generateCompletions } from './generate.js';
import { getCompletionValues, isDynamicCompletionType } from './dynamic.js';
import { generatePowerShell } from './powershell.js';

describe('generateCompletions', () => {
  it('returns all four shell scripts', () => {
    const scripts = generateCompletions();
    expect(Object.keys(scripts).sort()).toEqual(['bash', 'fish', 'powershell', 'zsh']);
  });

  it('bash script includes group commands and dynamic helper', () => {
    const { bash } = generateCompletions();
    expect(bash).toContain('_carina_complete');
    expect(bash).toContain('workspace');
    expect(bash).toContain('session');
    expect(bash).toContain('carina completion dynamic session-id');
    expect(bash).toContain('powershell');
  });

  it('fish script includes dynamic session completion', () => {
    const { fish } = generateCompletions();
    expect(fish).toContain('carina completion dynamic session-id');
    expect(fish).toContain('skill-name');
  });

  it('powershell script registers native completer', () => {
    const script = generatePowerShell();
    expect(script).toContain('Register-ArgumentCompleter');
    expect(script).toContain('workspace');
  });
});

describe('dynamic completion types', () => {
  it('recognizes supported types', () => {
    expect(isDynamicCompletionType('session-id')).toBe(true);
    expect(isDynamicCompletionType('unknown')).toBe(false);
  });

  it('returns workspace ids without throwing', async () => {
    const values = await getCompletionValues('workspace-id');
    expect(Array.isArray(values)).toBe(true);
  });

  it('returns empty array for unknown type', async () => {
    const values = await getCompletionValues('not-a-type');
    expect(values).toEqual([]);
  });
});

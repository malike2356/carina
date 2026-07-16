import { describe, expect, it } from 'vitest';
import {
  formatSubagentSummary,
  isSubagentBlockedTool,
  resolveSubagentAllowedTools,
  validateSubagentToolsets,
} from './subagent-policy.js';

describe('subagent-policy', () => {
  it('blocks delegation-style tools including send-message', () => {
    expect(isSubagentBlockedTool('delegate-task')).toBe(true);
    expect(isSubagentBlockedTool('memory')).toBe(true);
    expect(isSubagentBlockedTool('send-message')).toBe(true);
    expect(isSubagentBlockedTool('shell-exec')).toBe(false);
  });

  it('validates toolsets reject blocked tools', () => {
    expect(validateSubagentToolsets(['messaging'])).toContain('send-message');
    expect(validateSubagentToolsets(['terminal', 'file'])).toBeNull();
  });

  it('resolveSubagentAllowedTools applies defaults and leaf filter', () => {
    const tools = resolveSubagentAllowedTools([]);
    expect(tools).toContain('shell-exec');
    expect(tools).not.toContain('memory');
    expect(tools).not.toContain('delegate-task');
  });

  it('formatSubagentSummary truncates long output for parent context', () => {
    const long = 'x'.repeat(10_000);
    const out = formatSubagentSummary(long, 100);
    expect(out.length).toBeLessThan(200);
    expect(out).toContain('truncated for parent');
  });
});

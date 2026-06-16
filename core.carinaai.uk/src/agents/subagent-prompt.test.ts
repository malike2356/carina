import { describe, expect, it } from 'vitest';
import { buildSubagentSystemPromptParts, buildSubagentTaskSuffix } from './subagent-prompt.js';

describe('subagent-prompt', () => {
  it('buildSubagentSystemPromptParts omits full identity stack', () => {
    const parts = buildSubagentSystemPromptParts();
    const joined = parts.join('\n');
    expect(joined).toContain('Subagent mode');
    expect(joined).not.toContain('Knowing the operator');
    expect(joined).not.toContain('Group chats:');
  });

  it('buildSubagentTaskSuffix documents leaf vs orchestrator roles', () => {
    const leaf = buildSubagentTaskSuffix({ goal: 'scan logs', role: 'leaf', delegationDepth: 1 });
    expect(leaf).toContain('Role: leaf');
    expect(leaf).toContain('cannot delegate');

    const orch = buildSubagentTaskSuffix({ goal: 'coordinate', role: 'orchestrator', delegationDepth: 1 });
    expect(orch).toContain('Role: orchestrator');
    expect(orch).toContain('may delegate');
  });
});

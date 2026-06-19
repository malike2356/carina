import { describe, expect, it } from 'vitest';
import {
  buildAntiFabricationBlock,
  buildExecutionDisciplineBlock,
  buildSystemPromptParts,
  buildSystemPromptTierParts,
  buildSurfaceContext,
  buildToolPersistenceBlock,
  buildVerificationBlock,
  buildVolatileExecutionChecklist,
  CARINA_BASE_SYSTEM_PROMPT,
} from './system-prompt.js';
import { buildTurnDisciplineBlock } from './turn-discipline.js';
import { buildConversationDisciplineBlock } from './conversation-discipline.js';
import {
  buildCarinaIdentityBlock,
  buildHermesDefaultAgentIdentity,
  buildOpenClawSoulFallback,
} from './identity-defaults.js';

describe('buildExecutionDisciplineBlock', () => {
  it('forces real tool calls instead of described intentions', () => {
    const block = buildExecutionDisciplineBlock();
    expect(block).toContain('Tool-use enforcement:');
    expect(block).toContain('make the corresponding tool call in the same response');
    expect(block).toContain('Responses that only describe intentions without acting are not acceptable');
  });

  it('forbids fabricated tool output and requires finishing work', () => {
    const block = buildExecutionDisciplineBlock();
    expect(block).toContain('Anti-fabrication:');
    expect(block).toContain('NEVER substitute fabricated output');
    expect(block).toContain('Do not claim an action succeeded without a real tool result');
    expect(block).toContain('working artifact backed by real tool output');
    expect(block).toContain('Do not trail off mid-task');
  });

  it('requires tool persistence but keeps verification in volatile tier', () => {
    expect(buildToolPersistenceBlock()).toContain('retry with a different query or strategy');
    expect(buildVerificationBlock()).toContain('Grounding: factual claims are backed by tool outputs');
    const block = buildExecutionDisciplineBlock();
    expect(block).toContain('Tool persistence:');
    expect(block).not.toContain('Before finalizing a response:');
    expect(buildVolatileExecutionChecklist()).toContain('Before finalizing a response:');
    expect(buildVolatileExecutionChecklist()).toContain('Safety: confirm scope before side effects');
  });

  it('requires tools for factual system questions', () => {
    const block = buildExecutionDisciplineBlock();
    expect(block).toContain('Mandatory tool use (never answer from memory or mental computation):');
    expect(block).toContain('Git history, branches, diffs: shell-exec, git-brief-status');
    expect(block).toContain('File contents, sizes, line counts: file-read, search-files, shell-exec');
    expect(block).toContain('Hashes, encodings, checksums: shell-exec, base64-codec, text-hash');
    expect(block).toContain('Current time, date, timezone: shell-exec');
    expect(block).toContain('mental computation');
  });

  it('preserves light handling for casual messages', () => {
    const block = buildConversationDisciplineBlock();
    expect(block).toContain('Casual messages:');
    expect(block).toContain('answer in one line, no tools');
    expect(block).toContain('no capability tour');
  });
});

describe('buildCarinaIdentityBlock', () => {
  it('is included in the stable base prompt', () => {
    expect(buildCarinaIdentityBlock()).toContain('Default identity scaffold');
    expect(buildHermesDefaultAgentIdentity()).toContain('VERLOX Ltd');
    expect(buildOpenClawSoulFallback()).toContain('Core truths');
    expect(CARINA_BASE_SYSTEM_PROMPT).toContain('Core truths');
    expect(CARINA_BASE_SYSTEM_PROMPT).toContain('Workspace IDENTITY.md');
    expect(CARINA_BASE_SYSTEM_PROMPT).toContain('BOOTSTRAP.md is one-shot setup only');
    expect(CARINA_BASE_SYSTEM_PROMPT).toContain('DREAMS.md');
  });
});

describe('buildTurnDisciplineBlock', () => {
  it('is included in the stable base prompt', () => {
    const block = buildTurnDisciplineBlock();
    expect(block).toContain('How to end a turn:');
    expect(block).toContain('After a tool fails:');
    expect(CARINA_BASE_SYSTEM_PROMPT).toContain('How to end a turn:');
    expect(CARINA_BASE_SYSTEM_PROMPT).toContain('DO NOT go silent');
  });
});

describe('buildSystemPromptParts', () => {
  it('includes memory discipline in the stable base prompt part', () => {
    const parts = buildSystemPromptParts();
    const base = parts[0] ?? '';
    expect(base).toContain('Memory discipline:');
    expect(base).toContain('Retrieval discipline:');
    expect(base).toContain('not instructions to yourself');
    expect(base).toContain('Tool-use enforcement:');
    expect(base).toContain('Mandatory tool use (never answer from memory or mental computation):');
    expect(base).toContain('Casual messages:');
    expect(base).toContain('How to end a turn:');
    expect(base).toContain('Group chats:');
    expect(base).toContain('Proactive behavior:');
    expect(base).toContain('Write it down:');
    expect(base).not.toContain('Before finalizing a response:');
  });

  it('splits stable and context tiers (ASP-08)', () => {
    const tiers = buildSystemPromptTierParts();
    expect(tiers.stable.length).toBeGreaterThan(0);
    expect(tiers.context.length).toBeGreaterThan(0);
    expect(tiers.context.join('\n')).toContain('Feature guidance:');
    expect(tiers.context.join('\n')).toContain('When a user asks how to use a feature');
    expect(tiers.context.join('\n')).toContain('If a new feature is added later');
  });
});

describe('CARINA_BASE_SYSTEM_PROMPT', () => {
  it('snapshots hardened discipline text in the base prompt', () => {
    expect(CARINA_BASE_SYSTEM_PROMPT).toMatchSnapshot();
  });
});

describe('buildSurfaceContext', () => {
  it('adds Discord formatting guidance', () => {
    const ctx = buildSurfaceContext('discord');
    expect(ctx).toContain('Output format (Discord):');
    expect(ctx).toContain('Do not use markdown tables');
  });

  it('gives web UI guidance for configuration questions', () => {
    const ctx = buildSurfaceContext('web');
    expect(ctx).toContain('Current surface: web UI.');
    expect(ctx).toContain('For skill packs, open /packs in the web UI');
    expect(ctx).toContain('Only mention CLI commands');
    expect(ctx).toContain('Session anchors (web UI):');
  });

  it('gives CLI guidance for command-line questions', () => {
    const ctx = buildSurfaceContext('cli');
    expect(ctx).toContain('Current surface: CLI.');
    expect(ctx).toContain('prefer command-line steps');
  });
});

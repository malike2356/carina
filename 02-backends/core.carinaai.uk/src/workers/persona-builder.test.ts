import { describe, expect, it } from 'vitest';
import {
  buildCustomPersonaPrompt,
  buildPersonaPrompt,
  SUB_AGENT_AUTONOMY_BLOCK,
} from './persona-builder.js';
import { ROLE_TEMPLATES } from './role-templates.js';

describe('persona-builder', () => {
  it('builds template persona with autonomy block and escalate marker', () => {
    const template = ROLE_TEMPLATES[0];
    const prompt = buildPersonaPrompt('Alex', template, 'Focus on Block C tenants.');
    expect(prompt).toContain('Your name is Alex.');
    expect(prompt).toContain(template.personaBlocks.role);
    expect(prompt).toContain(SUB_AGENT_AUTONOMY_BLOCK);
    expect(prompt).toContain('[ESCALATE]');
    expect(prompt).toContain('Focus on Block C tenants.');
  });

  it('builds custom persona with autonomy block', () => {
    const prompt = buildCustomPersonaPrompt('Sam', 'Handle vendor invoices.');
    expect(prompt).toContain('Your name is Sam.');
    expect(prompt).toContain('Handle vendor invoices.');
    expect(prompt).toContain(SUB_AGENT_AUTONOMY_BLOCK);
    expect(prompt).toContain('[ESCALATE]');
  });
});

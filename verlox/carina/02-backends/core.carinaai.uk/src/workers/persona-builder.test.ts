import { describe, expect, it } from 'vitest';
import {
  AIVA_WORKER_IDENTITY_MARKER,
  buildCustomPersonaPrompt,
  buildPersonaPrompt,
  buildWorkerIdentityOverride,
  publicWorkerName,
  SUB_AGENT_AUTONOMY_BLOCK,
  withWorkerIdentityOverride,
} from './persona-builder.js';
import { ROLE_TEMPLATES } from './role-templates.js';

describe('persona-builder', () => {
  it('builds template persona with autonomy block and escalate marker', () => {
    const template = ROLE_TEMPLATES[0];
    const prompt = buildPersonaPrompt('Alex', template, 'Focus on Block C tenants.');
    expect(prompt).toContain('Your name is Alex.');
    expect(prompt).toContain(AIVA_WORKER_IDENTITY_MARKER);
    expect(prompt).toContain('You are NOT Carina.');
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
    expect(prompt).toContain('You are NOT Carina.');
  });

  it('strips role suffix from long hire display names', () => {
    expect(publicWorkerName('Selorm Aiva - The the Genral purpose Assistant')).toBe('Selorm Aiva');
  });

  it('wraps legacy persona prompts with identity override at runtime', () => {
    const wrapped = withWorkerIdentityOverride(
      'Selorm Aiva - Assistant',
      'Your name is Selorm Aiva.\n\nBe helpful.',
      'Answers enquiries around the clock',
    );
    expect(wrapped.startsWith(AIVA_WORKER_IDENTITY_MARKER)).toBe(true);
    expect(wrapped).toContain('You are Selorm Aiva, an AI employee');
    expect(wrapped).toContain('You are NOT Carina.');
    expect(wrapped).toContain('Be helpful.');
    expect(buildWorkerIdentityOverride('Selorm').includes('NOT Carina')).toBe(true);
  });
});

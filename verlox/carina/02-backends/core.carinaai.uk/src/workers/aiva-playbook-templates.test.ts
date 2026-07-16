import { describe, expect, it } from 'vitest';
import {
  defaultPlaybookIdForRoleTemplate,
  getAivaPlaybookTemplate,
  listAivaPlaybookTemplates,
  resolvePlaybookVariables,
} from './aiva-playbook-templates.js';

describe('aiva-playbook-templates', () => {
  it('lists property deal analysis template', () => {
    const templates = listAivaPlaybookTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(1);
    expect(templates[0]?.id).toBe('aiva-deal-analyse');
  });

  it('defaults property-manager hire to deal analysis playbook', () => {
    expect(defaultPlaybookIdForRoleTemplate('property-manager')).toBe('aiva-deal-analyse');
    expect(defaultPlaybookIdForRoleTemplate('email-handler')).toBeNull();
  });

  it('merges default variables with overrides', () => {
    const vars = resolvePlaybookVariables('aiva-deal-analyse', { client_email: 'a@example.com' });
    expect(vars.min_score).toBe(65);
    expect(vars.client_email).toBe('a@example.com');
  });

  it('resolves template by id', () => {
    const template = getAivaPlaybookTemplate('aiva-deal-analyse');
    expect(template?.vertical).toBe('property');
    expect(template?.defaultOnHire).toBe(true);
  });
});

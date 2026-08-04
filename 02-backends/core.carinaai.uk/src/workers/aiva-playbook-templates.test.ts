import { describe, expect, it } from 'vitest';
import { defaultPlaybookIdForRoleTemplate, listAivaPlaybookTemplates } from './aiva-playbook-templates.js';

describe('Aiva playbook templates', () => {
  it('includes the salesgrid outreach playbook and maps it to outreach coordinator', () => {
    const ids = listAivaPlaybookTemplates().map((template) => template.id);
    expect(ids).toContain('salesgrid-outreach');
    expect(defaultPlaybookIdForRoleTemplate('outreach-coordinator')).toBe('salesgrid-outreach');
  });
});

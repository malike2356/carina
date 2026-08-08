import { describe, expect, it } from 'vitest';
import { CARINA_HELP_KNOWLEDGE_BASE, CARINA_HELP_GREETING } from './knowledge';
import { carinaHelpRagContext } from './rag';

describe('carina-help knowledge base', () => {
  it('covers the current product surface and shared knowledge bridge', () => {
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Contacts');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Files');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('GitHub memory');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Scout is a separate governance product');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Aiva is the customer-facing AI Employee workspace');
  });

  it('covers stuck-point guidance for schedules, reminders, and telegram', () => {
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Schedules vs Automations vs personal tasks');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('NOT a personal todo list');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Reminder ID');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Telegram quiet');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Training tab');
  });

  it('greets users with the updated support scope', () => {
    expect(CARINA_HELP_GREETING).toContain('Aiva');
    expect(CARINA_HELP_GREETING).toContain('Scout');
  });

  it('covers deep safe product-ops topics without secret playbooks', () => {
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Safety and what never to disclose');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('CRM and Outreach');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('CRM Leads');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Linked lead files');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Soft Wall');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('How Aiva works');
    expect(CARINA_HELP_KNOWLEDGE_BASE).toContain('Research, Bookings, Files');
    expect(CARINA_HELP_KNOWLEDGE_BASE).not.toContain('.access/');
    expect(CARINA_HELP_KNOWLEDGE_BASE).not.toContain('CARINA_HOME');
    expect(CARINA_HELP_KNOWLEDGE_BASE).not.toContain('80.190.81.208');
  });

  it('retrieves contact, schedules, reminder, outreach, and soft wall help', () => {
    const contactsContext = carinaHelpRagContext('where do I find contacts');
    const bridgeContext = carinaHelpRagContext('how does the GitHub sync bridge work');
    const schedulesContext = carinaHelpRagContext('where is my task list reminder schedules');
    const telegramContext = carinaHelpRagContext('telegram aiva not replying quiet');
    const outreach = carinaHelpRagContext('how does outreach program sequences soft wall work');
    const softWall = carinaHelpRagContext('approvals soft wall email draft before send');
    const crm = carinaHelpRagContext('where is CRM leads table and delete linked lead sheet');
    const contactLeads = carinaHelpRagContext('ask aiva to contact leads discovery call soft wall');

    expect(contactsContext.toLowerCase()).toMatch(/contacts/);
    expect(bridgeContext.toLowerCase()).toMatch(/github|agent-sync|bridge/);
    expect(schedulesContext.toLowerCase()).toMatch(/schedules|reminder|todo|automations/);
    expect(telegramContext.toLowerCase()).toMatch(/telegram|botfather|channels/);
    expect(outreach.toLowerCase()).toMatch(/outreach|sequence|soft wall|crm/);
    expect(softWall.toLowerCase()).toMatch(/approval|soft wall|email/);
    expect(crm.toLowerCase()).toMatch(/crm|lead|sheet|delete/);
    expect(contactLeads.toLowerCase()).toMatch(/contact|soft wall|approval|lead/);
  });
});
